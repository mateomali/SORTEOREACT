package com.goodfellas.sorteo

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.*
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.print.PrintManager
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.TextView
import android.widget.EditText
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var errorView: TextView
    private val worker = Executors.newSingleThreadExecutor()
    private val startUrl = "https://www.sudokumerlo.com/sorteo/"
    private var uploadCallback: ValueCallback<Array<Uri>>? = null
    private data class Export(val file: File, val name: String, val mime: String, val done: (Boolean, Boolean) -> Unit)
    private var pendingSave: Export? = null
    private var exportBusy = false
    private var lastFailedUrl = startUrl
    private var bridgeReady = false
    private val bridgeScript by lazy { assets.open("native-bridge.js").bufferedReader().use { it.readText() } }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.statusBarColor = getColor(R.color.system_bar)
        window.navigationBarColor = getColor(R.color.system_bar)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webView)
        errorView = findViewById(R.id.errorView)
        webView.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true; loadsImagesAutomatically = true
            useWideViewPort = true; loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = true // Document-picker uploads use content:// URIs.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = false
            userAgentString += " GoodfellasAndroid/1.2"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        installBridge()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                if (!AppPolicy.isTrusted(url)) return super.onJsAlert(view, url, message, result)
                AlertDialog.Builder(this@MainActivity).setTitle("Goodfellas").setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }.show()
                return true
            }
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                if (!AppPolicy.isTrusted(url)) return super.onJsConfirm(view, url, message, result)
                AlertDialog.Builder(this@MainActivity).setTitle("Goodfellas").setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }.show()
                return true
            }
            override fun onJsPrompt(view: WebView, url: String, message: String, defaultValue: String?, result: JsPromptResult): Boolean {
                if (!AppPolicy.isTrusted(url)) return super.onJsPrompt(view, url, message, defaultValue, result)
                val input = EditText(this@MainActivity).apply { setText(defaultValue.orEmpty()); setSingleLine() }
                AlertDialog.Builder(this@MainActivity).setTitle("Goodfellas").setMessage(message).setView(input)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm(input.text.toString()) }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }.show()
                return true
            }
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                uploadCallback?.onReceiveValue(null); uploadCallback = callback
                try { startActivityForResult(params.createIntent().addCategory(Intent.CATEGORY_OPENABLE), UPLOAD) }
                catch (_: ActivityNotFoundException) { uploadCallback?.onReceiveValue(null); uploadCallback = null; toast("No hay selector de archivos disponible.") }
                return true
            }
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                if (!isUserGesture) return false
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        navigate(request.url); popup.destroy(); return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget(); return true
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (AppPolicy.isTrusted(request.url.toString())) return false // Preserve POSTs and redirects.
                if (request.isForMainFrame) openExternal(request.url)
                return true
            }
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                errorView.visibility = View.GONE; webView.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView, url: String) {
                if (AppPolicy.isTrusted(url) && bridgeReady) view.evaluateJavascript(bridgeScript, null)
                CookieManager.getInstance().flush()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showError(request.url.toString())
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame && response.statusCode >= 500) showError(request.url.toString())
            }
        }
        webView.setDownloadListener { url, _, disposition, mime, _ ->
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                if (bridgeReady) webView.evaluateJavascript("window.__goodfellasDownload?.(${JSONObject.quote(url)},${JSONObject.quote(URLUtil.guessFileName(url, disposition, mime))})", null)
                else toast("Actualizá Android System WebView para exportar archivos.")
            } else download(url, URLUtil.guessFileName(url, disposition, mime)) { _, _ -> }
        }
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) webView.loadUrl(startUrl)
        errorView.setOnClickListener { webView.loadUrl(lastFailedUrl) }
    }

    private fun installBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            toast("Actualizá Android System WebView para habilitar exportar y compartir."); return
        }
        WebViewCompat.addWebMessageListener(webView, "GoodfellasNative", AppPolicy.origins) { _, message, _, mainFrame, reply ->
            if (!mainFrame || !AppPolicy.isTrusted(webView.url)) return@addWebMessageListener
            val raw = message.data ?: return@addWebMessageListener
            if (raw.length > AppPolicy.MAX_BYTES * 4 / 3 + 8192) return@addWebMessageListener
            try {
                val data = JSONObject(raw)
                val done: (Boolean, Boolean) -> Unit = { ok, cancelled ->
                    if (!isDestroyed) reply.postMessage(JSONObject().put("id", data.optString("id")).put("ok", ok).put("cancelled", cancelled)
                        .put("error", if (cancelled) "Operación cancelada" else "No se pudo completar la operación. Intentá de nuevo.").toString())
                }
                when (data.optString("action")) {
                    "save" -> prepareFile(data, false, done)
                    "share" -> if (data.has("data")) prepareFile(data, true, done) else shareText(data, done)
                    "download" -> download(data.getString("url"), data.optString("name"), done)
                    "clipboard" -> {
                        (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Goodfellas", data.optString("text")))
                        done(true, false)
                    }
                    "print" -> try {
                        (getSystemService(PRINT_SERVICE) as PrintManager).print("Goodfellas", webView.createPrintDocumentAdapter("Goodfellas"), null)
                        done(true, false)
                    } catch (_: Exception) { done(false, false) }
                    else -> done(false, false)
                }
            } catch (_: Exception) { toast("No se pudo procesar la exportación.") }
        }
        bridgeReady = true
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) WebViewCompat.addDocumentStartJavaScript(webView, bridgeScript, AppPolicy.origins)
    }

    private fun exportFile(name: String): File {
        val directory = File(cacheDir, "exports").apply { mkdirs() }
        directory.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - 86400000L }?.forEach { it.delete() }
        return File(directory, "${System.nanoTime()}-${AppPolicy.filename(name)}")
    }
    private fun prepareFile(data: JSONObject, share: Boolean, done: (Boolean, Boolean) -> Unit) {
        if (exportBusy) { toast("Terminá la exportación anterior."); done(false, false); return }
        exportBusy = true
        worker.execute {
            var file: File? = null
            try {
                val bytes = Base64.decode(data.getString("data"), Base64.DEFAULT)
                require(bytes.size <= AppPolicy.MAX_BYTES)
                val name = AppPolicy.filename(data.optString("name"))
                val mime = data.optString("mime").substringBefore(';').takeIf { it.matches(Regex("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")) } ?: "application/octet-stream"
                file = exportFile(name).apply { writeBytes(bytes) }
                val export = Export(file, name, mime, done)
                runOnUiThread { if (share) shareFile(export, data) else chooseSave(export) }
            } catch (_: Exception) { file?.delete(); runOnUiThread { exportBusy = false; done(false, false) } }
        }
    }
    private fun download(url: String, suggestedName: String, done: (Boolean, Boolean) -> Unit) {
        if (!AppPolicy.isTrusted(url) || !AppPolicy.isTrusted(webView.url)) { toast("Abrí este enlace en el navegador para descargarlo."); done(false, false); return }
        if (exportBusy) { toast("Terminá la exportación anterior."); done(false, false); return }
        exportBusy = true
        val cookies = CookieManager.getInstance().getCookie(url)
        val agent = webView.settings.userAgentString
        worker.execute {
            var file: File? = null
            try {
                var destination = url
                var connection: HttpURLConnection? = null
                for (attempt in 0..5) {
                    require(AppPolicy.isTrusted(destination))
                    val current = URL(destination).openConnection() as HttpURLConnection
                    connection = current; current.instanceFollowRedirects = false
                    current.connectTimeout = 15000; current.readTimeout = 30000
                    current.setRequestProperty("User-Agent", agent)
                    if (Uri.parse(destination).host == Uri.parse(url).host && cookies != null) current.setRequestProperty("Cookie", cookies)
                    if (current.responseCode in 300..399) {
                        destination = URL(URL(destination), current.getHeaderField("Location") ?: error("Missing redirect")).toString()
                        current.disconnect()
                    } else break
                }
                val response = connection ?: error("Sin respuesta")
                try {
                    require(response.responseCode in 200..299)
                    val mime = response.contentType?.substringBefore(';') ?: "application/octet-stream"
                    require(mime != "text/html") // A login redirect is not an exported file.
                    val name = AppPolicy.filename(suggestedName.ifBlank { URLUtil.guessFileName(destination, response.getHeaderField("Content-Disposition"), mime) })
                    val target = exportFile(name); file = target
                    response.inputStream.use { input -> target.outputStream().use { output ->
                        val buffer = ByteArray(65536); var total = 0
                        while (true) { val size = input.read(buffer); if (size < 0) break; total += size; require(total <= AppPolicy.MAX_BYTES); output.write(buffer, 0, size) }
                    } }
                    val export = Export(target, name, mime, done)
                    runOnUiThread { chooseSave(export) }
                } finally { response.disconnect() }
            } catch (_: Exception) { file?.delete(); runOnUiThread { exportBusy = false; toast("No se pudo descargar. Revisá la conexión y tu sesión."); done(false, false) } }
        }
    }
    private fun chooseSave(export: Export) {
        if (isDestroyed) { export.file.delete(); return }
        pendingSave = export
        try { startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(export.mime).putExtra(Intent.EXTRA_TITLE, export.name), SAVE) }
        catch (_: ActivityNotFoundException) { pendingSave = null; exportBusy = false; export.file.delete(); export.done(false, false) }
    }
    private fun shareFile(export: Export, data: JSONObject) {
        try {
            val uri = FileProvider.getUriForFile(this, "$packageName.files", export.file)
            val intent = Intent(Intent.ACTION_SEND).setType(export.mime).putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_TEXT, data.optString("text")).putExtra(Intent.EXTRA_SUBJECT, data.optString("title"))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).apply { clipData = ClipData.newRawUri(export.name, uri) }
            startActivity(Intent.createChooser(intent, "Compartir con")); export.done(true, false)
        } catch (_: ActivityNotFoundException) { export.done(false, false) }
        finally { exportBusy = false }
    }
    private fun shareText(data: JSONObject, done: (Boolean, Boolean) -> Unit) {
        try {
            val text = listOf(data.optString("text"), data.optString("url")).filter { it.isNotBlank() }.joinToString("\n")
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                .putExtra(Intent.EXTRA_SUBJECT, data.optString("title")), "Compartir con")); done(true, false)
        } catch (_: ActivityNotFoundException) { done(false, false) }
    }
    @Deprecated("Compatible Activity result API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == UPLOAD) {
            uploadCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); uploadCallback = null
        } else if (requestCode == SAVE) {
            val export = pendingSave ?: return
            pendingSave = null
            val uri = data?.data
            if (resultCode != RESULT_OK || uri == null) { exportBusy = false; export.file.delete(); export.done(false, true); return }
            worker.execute {
                val success = try {
                    contentResolver.openOutputStream(uri, "wt")?.use { output -> export.file.inputStream().use { it.copyTo(output) } } ?: error("No se pudo guardar")
                    true
                } catch (_: Exception) { false }
                export.file.delete()
                runOnUiThread { exportBusy = false; toast(if (success) "Archivo guardado" else "No se pudo guardar el archivo"); export.done(success, false) }
            }
        }
    }
    private fun navigate(uri: Uri) { if (AppPolicy.isTrusted(uri.toString())) webView.loadUrl(uri.toString()) else openExternal(uri) }
    private fun openExternal(uri: Uri) {
        try {
            val intent = if (uri.scheme == "intent") Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).apply {
                component = null; selector = null; addCategory(Intent.CATEGORY_BROWSABLE); action = Intent.ACTION_VIEW
                require(data?.scheme in setOf("https", "http", "whatsapp", "mailto", "tel"))
            } else {
                require(uri.scheme in setOf("https", "http", "whatsapp", "mailto", "tel", "sms", "geo"))
                Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
            }
            startActivity(intent)
        } catch (_: Exception) { toast("No hay una aplicación disponible para abrir este enlace.") }
    }
    private fun showError(url: String) {
        lastFailedUrl = url.takeIf { AppPolicy.isTrusted(it) } ?: startUrl
        webView.visibility = View.GONE; errorView.visibility = View.VISIBLE; errorView.text = getString(R.string.load_error)
    }
    private fun toast(message: String) { if (!isDestroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
    override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
    override fun onPause() { CookieManager.getInstance().flush(); super.onPause() }
    @Deprecated("Back navigation compatible with Android 8+")
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
    override fun onDestroy() { uploadCallback?.onReceiveValue(null); webView.destroy(); worker.shutdown(); super.onDestroy() }
    companion object { private const val UPLOAD = 10; private const val SAVE = 11 }
}
