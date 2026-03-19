<?php
// Router for PHP built-in server
// Routes all requests through index.php (like Apache mod_rewrite)
$uri = $_SERVER['REQUEST_URI'];

// Serve static files directly
$path = __DIR__ . parse_url($uri, PHP_URL_PATH);
if (is_file($path)) {
    return false;
}

// Route everything else through index.php
include __DIR__ . '/index.php';
