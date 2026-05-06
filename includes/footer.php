    </main>
  </div>
  <script src="assets/app-ui.js?v=<?= h((string) (@filemtime(__DIR__ . '/../assets/app-ui.js') ?: time())) ?>"></script>
  <script src="assets/app.js?v=<?= h((string) (@filemtime(__DIR__ . '/../assets/app.js') ?: time())) ?>"></script>
  <?php $reactAppPath = __DIR__ . '/../assets/react/react-app.js'; ?>
  <?php if (is_file($reactAppPath)): ?>
    <script type="module" src="assets/react/react-app.js?v=<?= h((string) filemtime($reactAppPath)) ?>"></script>
  <?php endif; ?>
</body>
</html>
