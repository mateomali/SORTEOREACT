    </main>
  </div>
  <?php if (!empty($enableClientDiagnostics)): ?>
    <script>
      (function () {
        var endpoint = 'diagnostics_log.php';
        function send(kind, payload) {
          try {
            var body = JSON.stringify({
              kind: kind,
              url: window.location.href,
              userAgent: window.navigator.userAgent,
              payload: payload || {}
            });
            if (window.navigator.sendBeacon) {
              window.navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
              return;
            }
            window.fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: body,
              keepalive: true
            }).catch(function () {});
          } catch (error) {}
        }

        window.addEventListener('error', function (event) {
          send('window_error', {
            message: event.message || '',
            source: event.filename || '',
            line: event.lineno || 0,
            column: event.colno || 0,
            error: event.error && event.error.stack ? event.error.stack : String(event.error || '')
          });
        }, true);

        window.addEventListener('unhandledrejection', function (event) {
          var reason = event.reason || {};
          send('unhandled_rejection', {
            message: reason.message || String(reason),
            stack: reason.stack || ''
          });
        });

        send('diagnostics_loaded', {
          readyState: document.readyState,
          rootCount: document.querySelectorAll('[data-react-root]').length
        });
      })();
    </script>
  <?php endif; ?>
  <script src="assets/app-ui.js?v=<?= h((string) (@filemtime(__DIR__ . '/../assets/app-ui.js') ?: time())) ?>"></script>
  <script src="assets/app.js?v=<?= h((string) (@filemtime(__DIR__ . '/../assets/app.js') ?: time())) ?>"></script>
  <?php $reactAppPath = __DIR__ . '/../assets/react/react-app.js'; ?>
  <?php if (is_file($reactAppPath)): ?>
    <script type="module" src="assets/react/react-app.js?v=<?= h((string) filemtime($reactAppPath)) ?>"></script>
  <?php endif; ?>
</body>
</html>
