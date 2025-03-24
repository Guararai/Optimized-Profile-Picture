const { createServer } = require('node:http');
const { Buffer } = require('node:buffer');
const sharp = require('sharp');
const busboy = require('busboy');

const hostname = '127.0.0.1';
const port = 3000;

const server = createServer((req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/upload') {
        const bb = busboy({ headers: req.headers });
        let imageBuffer = Buffer.alloc(0);

        // Handler de erros
        bb.on('error', (error) => {
            console.error('Erro no Busboy:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Erro no upload' }));
            }
        });

        bb.on('file', (fieldname, file, fileInfo) => {
            file.on('data', (data) => {
                imageBuffer = Buffer.concat([imageBuffer, data]);
            });

            file.on('end', async () => {
                try {
                    // Processar imagem com Sharp
                    const processedImage = await sharp(imageBuffer)
                        .resize(200, 200)
                        .jpeg({ quality: 80, mozjpeg: true })
                        .toBuffer();

                    const metadata = await sharp(processedImage).metadata();
                    const base64Image = processedImage.toString('base64');
                    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        imageUrl: imageUrl,
                        metadata: {
                            format: metadata.format,
                            width: metadata.width,
                            height: metadata.height,
                            size: processedImage.length
                        }
                    }));

                } catch (error) {
                    console.error('Erro no Sharp:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: error.message }));
                    }
                }
            });
        });

        req.pipe(bb);

    } else {
        // Frontend HTML
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Profile Picture Test</title>
                <style>
                    body { font-family: Arial; padding: 20px; }
                    .upload-box {
                        border: 2px dashed #666;
                        padding: 40px;
                        text-align: center;
                        cursor: pointer;
                        margin: 20px 0;
                    }
                    #preview {
                        width: 96px;
                        height: 96px;
                        border-radius: 50%;
                        overflow: hidden;
                        margin: 20px auto;
                        border: 2px solid #333;
                    }
                    #preview img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    #metadata {
                        background: #f0f0f0;
                        padding: 15px;
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <h1>Upload de Foto de Perfil</h1>
                
                <form id="uploadForm">
                    <div class="upload-box" onclick="document.getElementById('fileInput').click()">
                        Clique aqui ou arraste uma imagem
                    </div>
                    <input 
                        type="file" 
                        id="fileInput" 
                        accept="image/*" 
                        style="display: none"
                    >
                    <button type="submit">Processar</button>
                </form>

                <div id="result" style="display: none;">
                    <h3>Pré-visualização:</h3>
                    <div id="preview">
                        <img id="previewImage">
                    </div>
                    <h3>Informações:</h3>
                    <pre id="metadata"></pre>
                </div>

                <script>
                    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const file = document.getElementById('fileInput').files[0];
                        
                        if (!file) {
                            alert('Selecione uma imagem!');
                            return;
                        }

                        const formData = new FormData();
                        formData.append('image', file);

                        try {
                            const response = await fetch('http://localhost:3000/upload', {
                                method: 'POST',
                                body: formData
                            });

                            const data = await response.json();

                            if (!data.success) {
                                throw new Error(data.error || 'Erro desconhecido');
                            }

                            document.getElementById('previewImage').src = data.imageUrl;
                            document.getElementById('metadata').textContent = 
                                \`Formato: \${data.metadata.format}\\n\` +
                                \`Dimensões: \${data.metadata.width}x\${data.metadata.height}\\n\` +
                                \`Tamanho: \${(data.metadata.size / 1024).toFixed(2)} KB\`;

                            document.getElementById('result').style.display = 'block';

                        } catch (error) {
                            alert(\`ERRO: \${error.message}\`);
                        }
                    });
                </script>
            </body>
            </html>
        `);
    }
});

server.listen(port, hostname, () => {
    console.log(`Servidor rodando em http://${hostname}:${port}/`);
});