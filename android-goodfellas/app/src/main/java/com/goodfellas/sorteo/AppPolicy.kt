package com.goodfellas.sorteo

import java.net.URI

object AppPolicy {
    const val MAX_BYTES = 32 * 1024 * 1024
    val origins = setOf("https://www.sudokumerlo.com", "https://sudokumerlo.com")
    fun isTrusted(url: String?): Boolean = try {
        val uri = URI(url ?: "")
        uri.scheme == "https" && uri.host in setOf("www.sudokumerlo.com", "sudokumerlo.com") &&
            (uri.port == -1 || uri.port == 443) && uri.userInfo == null &&
            uri.normalize().path == uri.path && !uri.path.split('/').any { it == "." || it == ".." } &&
            (uri.path == "/sorteo" || uri.path.startsWith("/sorteo/"))
    } catch (_: Exception) { false }
    fun filename(name: String): String = name.substringAfterLast('/').substringAfterLast('\\')
        .replace(Regex("[\\p{Cntrl}:*?\"<>|]"), "_").trim().take(160)
        .takeUnless { it.isBlank() || it == "." || it == ".." } ?: "goodfellas-exportacion"
}
