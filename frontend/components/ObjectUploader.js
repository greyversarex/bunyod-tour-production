/**
 * ObjectUploader - простой компонент для загрузки файлов в object storage
 */
class ObjectUploader {
    constructor(options = {}) {
        this.maxFiles = options.maxFiles || 5;
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || ((error) => console.error('Upload error:', error));
        this.onProgress = options.onProgress || (() => {});
        
        this.uploadedFiles = [];
    }

    /**
     * Создает HTML элемент загрузчика
     */
    createElement(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        container.innerHTML = `
            <div class="object-uploader">
                <div class="upload-area" id="${containerId}-upload-area">
                    <div class="upload-zone" id="${containerId}-upload-zone">
                        <div class="upload-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 text-gray-400">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div class="upload-text">
                            <p class="text-lg font-medium text-gray-900">Перетащите файлы сюда</p>
                            <p class="text-sm text-gray-500">или нажмите для выбора</p>
                        </div>
                        <input 
                            type="file" 
                            id="${containerId}-file-input" 
                            multiple 
                            accept="${this.allowedTypes.join(',')}"
                            style="display: none;"
                        >
                    </div>
                </div>
                <div class="upload-progress" id="${containerId}-progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="${containerId}-progress-fill"></div>
                    </div>
                    <div class="progress-text" id="${containerId}-progress-text">0%</div>
                </div>
                <div class="uploaded-files" id="${containerId}-uploaded-files"></div>
            </div>
        `;

        this.setupEventListeners(containerId);
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners(containerId) {
        const uploadZone = document.getElementById(`${containerId}-upload-zone`);
        const fileInput = document.getElementById(`${containerId}-file-input`);

        // Клик по зоне загрузки
        uploadZone.addEventListener('click', () => {
            fileInput.click();
        });

        // Выбор файлов
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files, containerId);
        });

        // Drag & Drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files, containerId);
        });
    }

    /**
     * Обработка выбранных файлов
     */
    async handleFiles(files, containerId) {
        const fileArray = Array.from(files);
        
        // Проверка количества файлов
        if (this.uploadedFiles.length + fileArray.length > this.maxFiles) {
            this.onError(`Максимум ${this.maxFiles} файлов`);
            return;
        }

        // Валидация файлов
        for (const file of fileArray) {
            if (!this.validateFile(file)) {
                return;
            }
        }

        // Загрузка файлов
        for (const file of fileArray) {
            await this.uploadFile(file, containerId);
        }
    }

    /**
     * Валидация файла
     */
    validateFile(file) {
        // Проверка типа файла
        if (!this.allowedTypes.includes(file.type)) {
            this.onError(`Неподдерживаемый тип файла: ${file.type}`);
            return false;
        }

        // Проверка размера файла
        if (file.size > this.maxFileSize) {
            this.onError(`Файл слишком большой: ${(file.size / 1024 / 1024).toFixed(2)}MB. Максимум: ${(this.maxFileSize / 1024 / 1024).toFixed(2)}MB`);
            return false;
        }

        return true;
    }

    /**
     * Загрузка файла
     */
    async uploadFile(file, containerId) {
        try {
            this.showProgress(containerId);

            // Получение URL для загрузки
            const uploadResponse = await fetch('/api/objects/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!uploadResponse.ok) {
                throw new Error('Не удалось получить URL для загрузки');
            }

            const { uploadURL } = await uploadResponse.json();

            // Загрузка файла
            const uploadRequest = new XMLHttpRequest();
            
            uploadRequest.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.updateProgress(percentComplete, containerId);
                }
            });

            uploadRequest.onreadystatechange = () => {
                if (uploadRequest.readyState === XMLHttpRequest.DONE) {
                    if (uploadRequest.status === 200) {
                        this.onFileUploaded(file, uploadURL, containerId);
                    } else {
                        this.onError('Ошибка загрузки файла');
                    }
                    this.hideProgress(containerId);
                }
            };

            uploadRequest.open('PUT', uploadURL);
            uploadRequest.setRequestHeader('Content-Type', file.type);
            uploadRequest.send(file);

        } catch (error) {
            console.error('Upload error:', error);
            this.onError('Ошибка загрузки: ' + error.message);
            this.hideProgress(containerId);
        }
    }

    /**
     * Обработка успешно загруженного файла
     */
    onFileUploaded(file, uploadURL, containerId) {
        const fileInfo = {
            name: file.name,
            url: uploadURL,
            size: file.size,
            type: file.type
        };

        this.uploadedFiles.push(fileInfo);
        this.displayUploadedFile(fileInfo, containerId);
        this.onComplete(fileInfo, this.uploadedFiles);
    }

    /**
     * Отображение загруженного файла
     */
    displayUploadedFile(fileInfo, containerId) {
        const container = document.getElementById(`${containerId}-uploaded-files`);
        
        const fileElement = document.createElement('div');
        fileElement.className = 'uploaded-file';
        fileElement.innerHTML = `
            <div class="file-preview">
                <img src="${fileInfo.url}" alt="${fileInfo.name}" class="file-thumbnail">
            </div>
            <div class="file-info">
                <div class="file-name">${fileInfo.name}</div>
                <div class="file-size">${(fileInfo.size / 1024).toFixed(1)} KB</div>
            </div>
            <button class="remove-file" onclick="this.parentElement.remove()">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `;

        container.appendChild(fileElement);
    }

    /**
     * Отображение прогресса
     */
    showProgress(containerId) {
        const progress = document.getElementById(`${containerId}-progress`);
        progress.style.display = 'block';
    }

    hideProgress(containerId) {
        const progress = document.getElementById(`${containerId}-progress`);
        progress.style.display = 'none';
    }

    updateProgress(percent, containerId) {
        const fill = document.getElementById(`${containerId}-progress-fill`);
        const text = document.getElementById(`${containerId}-progress-text`);
        
        fill.style.width = `${percent}%`;
        text.textContent = `${Math.round(percent)}%`;
        
        this.onProgress(percent);
    }

    /**
     * Получение списка загруженных файлов
     */
    getUploadedFiles() {
        return this.uploadedFiles;
    }

    /**
     * Очистка загруженных файлов
     */
    clear(containerId) {
        this.uploadedFiles = [];
        const container = document.getElementById(`${containerId}-uploaded-files`);
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Стили для компонента
const uploaderStyles = `
<style>
.object-uploader {
    width: 100%;
    max-width: 600px;
}

.upload-zone {
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #f9fafb;
}

.upload-zone:hover {
    border-color: #6b7280;
    background-color: #f3f4f6;
}

.upload-zone.drag-over {
    border-color: #3b82f6;
    background-color: #eff6ff;
}

.upload-icon {
    margin-bottom: 16px;
}

.upload-progress {
    margin: 20px 0;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background-color: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background-color: #3b82f6;
    transition: width 0.3s ease;
}

.progress-text {
    text-align: center;
    margin-top: 8px;
    font-size: 14px;
    color: #6b7280;
}

.uploaded-files {
    margin-top: 20px;
}

.uploaded-file {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 8px;
    background-color: white;
}

.file-preview {
    flex-shrink: 0;
}

.file-thumbnail {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 4px;
}

.file-info {
    flex-grow: 1;
}

.file-name {
    font-weight: 500;
    font-size: 14px;
}

.file-size {
    font-size: 12px;
    color: #6b7280;
}

.remove-file {
    flex-shrink: 0;
    padding: 6px;
    border: none;
    background-color: #fee2e2;
    color: #dc2626;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.remove-file:hover {
    background-color: #fecaca;
}
</style>
`;

// Добавляем стили к документу
if (!document.querySelector('#object-uploader-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'object-uploader-styles';
    styleElement.innerHTML = uploaderStyles;
    document.head.appendChild(styleElement);
}