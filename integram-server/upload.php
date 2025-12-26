<?php
$uploadDir = '/tmp/uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $filename = basename($file['name']);
    $targetPath = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode(['success' => true, 'message' => "✅ Файл $filename загружен в $targetPath"]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '❌ Ошибка загрузки']);
    }
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Загрузка SQL файлов</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
        .drop-zone { border: 3px dashed #ccc; padding: 50px; text-align: center; 
                     border-radius: 10px; cursor: pointer; transition: all 0.3s; }
        .drop-zone.dragover { background: #e0e0e0; border-color: #333; }
        input[type="file"] { display: none; }
        .btn { background: #4CAF50; color: white; padding: 10px 20px; 
               border: none; border-radius: 5px; cursor: pointer; margin-top: 20px; font-size: 16px; }
        .btn:hover { background: #45a049; }
        #status { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .file-info { margin-top: 10px; color: #666; }
    </style>
</head>
<body>
    <h1>📁 Загрузка SQL файлов</h1>
    <p>Файлы будут сохранены в: <code>/tmp/uploads/</code></p>
    
    <form id="uploadForm" enctype="multipart/form-data">
        <div class="drop-zone" id="dropZone">
            <p>📤 Перетащите SQL файл сюда<br>или кликните для выбора</p>
            <input type="file" id="fileInput" name="file" accept=".sql,.txt,.gz">
        </div>
        <div class="file-info" id="fileInfo"></div>
        <button type="submit" class="btn">⬆️ Загрузить на сервер</button>
    </form>
    <div id="status"></div>
    
    <script>
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const form = document.getElementById('uploadForm');
        const status = document.getElementById('status');
        const fileInfo = document.getElementById('fileInfo');
        
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            fileInput.files = e.dataTransfer.files;
            updateFileInfo();
        });
        
        fileInput.addEventListener('change', updateFileInfo);
        
        function updateFileInfo() {
            if (fileInput.files[0]) {
                const file = fileInput.files[0];
                const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                dropZone.querySelector('p').innerHTML = `📄 ${file.name}<br><small>${sizeMB} MB</small>`;
                fileInfo.textContent = `Готов к загрузке: ${file.name} (${sizeMB} MB)`;
            }
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!fileInput.files[0]) {
                status.textContent = '❌ Выберите файл';
                status.className = 'error';
                status.style.display = 'block';
                return;
            }
            
            const formData = new FormData(form);
            
            status.textContent = '⏳ Загрузка... Пожалуйста, подождите';
            status.className = '';
            status.style.display = 'block';
            
            try {
                const response = await fetch('', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                status.textContent = result.message;
                status.className = result.success ? 'success' : 'error';
                
                if (result.success) {
                    setTimeout(() => {
                        dropZone.querySelector('p').innerHTML = '📤 Перетащите SQL файл сюда<br>или кликните для выбора';
                        fileInput.value = '';
                        fileInfo.textContent = '';
                        status.style.display = 'none';
                    }, 3000);
                }
            } catch (err) {
                status.textContent = '❌ Ошибка: ' + err.message;
                status.className = 'error';
            }
        });
    </script>
</body>
</html>
