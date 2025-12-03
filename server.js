// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const multer = require('multer');
const { exec,spawn } = require('child_process');
const app = express();
const PORT = 8237;

let db;
let currentDatasetPath = '';

// --- 中间件 ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', (req, res, next) => {
    if (currentDatasetPath) {
        express.static(currentDatasetPath)(req, res, next);
    } else {
        res.status(404).send('No dataset selected');
    }
});

// --- 数据库辅助函数 ---
const initializeDatabase = async (dbPath) => {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    await db.exec(`PRAGMA foreign_keys = ON;`);
    await db.exec(`
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY,
            tag_name TEXT NOT NULL UNIQUE,
            tag_bcolor TEXT DEFAULT '#eeeeee',
            tag_fcolor TEXT DEFAULT '#333333'
        );
        CREATE TABLE IF NOT EXISTS image_tags (
            image_id INTEGER,
            tag_id INTEGER,
            "order" INTEGER,
            FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
            PRIMARY KEY (image_id, tag_id)
        );
    `);
    console.log('Database initialized successfully at:', dbPath);
};

// --- Multer 设置 ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, currentDatasetPath),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// --- API 路由 ---

// --- 新增 API: 调用系统原生文件夹选择框 (Windows) ---
app.get('/api/system/pick-folder', (req, res) => {
    // 使用 PowerShell 调用 Windows Forms 的 FolderBrowserDialog
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.ShowNewFolderButton = $true
        $f.Description = "请选择数据集文件夹"
        if ($f.ShowDialog() -eq 'OK') {
            $path = $f.SelectedPath
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($path)
            $base64 = [Convert]::ToBase64String($bytes)
            Write-Host $base64
        } else {
            Write-Host "CANCEL"
        }
    `;
    //Write-Host $f.SelectedPath

    const child = spawn('powershell.exe', ['-Command', psScript]);
    let output = '';

    child.stdout.on('data', (data) => {
        output += data.toString();
    });

    child.on('close', (code) => {
        const result = output.trim();
        if (result === 'CANCEL' || result === '') {
            res.json({ canceled: true });
        } else {
            try {
                //    Node.js 端解码：
                //    将接收到的 Base64 字符串转回 UTF-8 字符串
                const decodedPath = Buffer.from(result, 'base64').toString('utf-8');
                res.json({ canceled: false, path: decodedPath });
            } catch (e) {
                console.error("解码路径失败:", e);
                res.status(500).json({ error: 'Path decoding failed' });
            }
            //res.json({ canceled: false, path: result });
        }
    });

    child.on('error', (err) => {
        console.error("Failed to spawn folder picker:", err);
        res.status(500).json({ error: 'Failed to open system dialog' });
    });
});

// 1. 设置并执行严格同步
app.post('/api/dataset', async (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'Folder path is required.' });

    try {
        currentDatasetPath = folderPath;
        const dbPath = path.join(currentDatasetPath, 'dataset.sqlite');
        await initializeDatabase(dbPath);

        // --- 开始严格同步逻辑 ---
        await db.run('BEGIN TRANSACTION');

        // 步骤 1: 获取事实 (文件系统)
        const allFiles = await fs.readdir(currentDatasetPath);
        const imageFiles = allFiles.filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f));
        const folderSet = new Set(imageFiles);

        // 步骤 2: 获取现状 (数据库)
        const dbImages = await db.all('SELECT file_path FROM images');
        const dbFilePaths = dbImages.map(row => row.file_path);
        const dbSet = new Set(dbFilePaths);

        // 步骤 3: 对比差异
        const filesToAdd = imageFiles.filter(f => !dbSet.has(f));
        const filesToDelete = dbFilePaths.filter(f => !folderSet.has(f));

        // 执行删除
        if (filesToDelete.length > 0) {
            const placeholders = filesToDelete.map(() => '?').join(',');
            await db.run(`DELETE FROM images WHERE file_path IN (${placeholders})`, filesToDelete);
        }

        // 执行新增
        if (filesToAdd.length > 0) {
            const stmt = await db.prepare('INSERT INTO images (file_path) VALUES (?)');
            for (const filename of filesToAdd) {
                await stmt.run(filename);
            }
            await stmt.finalize();
        }

        // 步骤 4: 更新所有现有图片的内容
        for (const filename of imageFiles) {
            const { id: imageId } = await db.get('SELECT id FROM images WHERE file_path = ?', filename);
            if (!imageId) continue;

            const txtPath = path.join(currentDatasetPath, `${path.parse(filename).name}.txt`);
            let tagsFromTxt = [];
            try {
                const txtContent = await fs.readFile(txtPath, 'utf8');
                tagsFromTxt = txtContent.split(',').map(t => t.trim()).filter(Boolean);
            } catch (err) { /* .txt文件不存在，忽略 */ }

            await db.run('DELETE FROM image_tags WHERE image_id = ?', imageId);
            for (let i = 0; i < tagsFromTxt.length; i++) {
                const tagName = tagsFromTxt[i];
                const { id: tagId } = await db.get(`
                    INSERT INTO tags (tag_name) VALUES (?) 
                    ON CONFLICT(tag_name) DO UPDATE SET tag_name=excluded.tag_name 
                    RETURNING id`, tagName);
                await db.run('INSERT OR IGNORE INTO image_tags (image_id, tag_id, "order") VALUES (?, ?, ?)', imageId, tagId, i);
            }
        }

        await db.run('COMMIT');
        // --- 严格同步逻辑结束 ---

        res.json({ message: `同步完成。新增 ${filesToAdd.length} 张图片，移除 ${filesToDelete.length} 张过时记录。` });

    } catch (err) {
        if (db) await db.run('ROLLBACK');
        console.error(`Error processing dataset at ${folderPath}:`, err);
        res.status(500).json({ error: 'Failed to process dataset.' });
    }
});

// 2. 获取图片列表 (分页)
app.get('/api/images', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const offset = (page - 1) * pageSize;

    try {
        const { total } = await db.get('SELECT COUNT(*) as total FROM images');
        const images = await db.all('SELECT file_path FROM images ORDER BY file_path LIMIT ? OFFSET ?', [pageSize, offset]);
        res.json({
            total,
            data: images.map(img => ({
                name: path.parse(img.file_path).name,
                filename: img.file_path,
                path: `/images/${encodeURIComponent(img.file_path)}`
            }))
        });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch images.' }); }
});

// 3. 获取单个图片的标签
app.get('/api/images/:filename/tags', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    try {
        const tags = await db.all(`
            SELECT t.tag_name as name, t.tag_bcolor as "bg", t.tag_fcolor as "text"
            FROM tags t
            JOIN image_tags it ON t.id = it.tag_id
            JOIN images i ON i.id = it.image_id
            WHERE i.file_path = ?
            ORDER BY it."order" ASC
        `, req.params.filename);

        const formattedTags = tags.map(t => ({ name: t.name, color: { bg: t.bg, text: t.text } }));
        res.json(formattedTags);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tags for image.' });
    }
});

// 4. 保存/更新多个图片的标签
app.post('/api/tags/save', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    const { filenames, tags } = req.body;
    if (!filenames || !tags || filenames.length === 0) {
        return res.status(400).json({ error: 'Filenames and tags are required.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        for (const filename of filenames) {
            const image = await db.get('SELECT id FROM images WHERE file_path = ?', filename);
            if (!image) continue;

            await db.run('DELETE FROM image_tags WHERE image_id = ?', image.id);

            for (let i = 0; i < tags.length; i++) {
                const tag = tags[i];
                const { id: tagId } = await db.get(`
                    INSERT INTO tags (tag_name, tag_bcolor, tag_fcolor) VALUES (?, ?, ?)
                    ON CONFLICT(tag_name) DO UPDATE SET 
                        tag_bcolor = COALESCE(excluded.tag_bcolor, tag_bcolor),
                        tag_fcolor = COALESCE(excluded.tag_fcolor, tag_fcolor)
                    RETURNING id
                `, tag.name, tag.color.bg, tag.color.text);
                await db.run('INSERT INTO image_tags (image_id, tag_id, "order") VALUES (?, ?, ?)', image.id, tagId, i);
            }

            const tagString = tags.map(t => t.name).join(', ');
            const txtPath = path.join(currentDatasetPath, `${path.parse(filename).name}.txt`);
            await fs.writeFile(txtPath, tagString);
        }

        await db.run('COMMIT');
        res.json({ message: `Tags for ${filenames.length} images saved successfully.` });
    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Error saving tags:', err);
        res.status(500).json({ error: 'Failed to save tags.' });
    }
});

// 5. 拖拽上传图片
app.post('/api/upload', upload.array('images'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
    }
    try {
        const stmt = await db.prepare('INSERT OR IGNORE INTO images (file_path) VALUES (?)');
        for (const file of req.files) {
            await stmt.run(file.originalname);
            const txtPath = path.join(currentDatasetPath, `${path.parse(file.originalname).name}.txt`);
            await fs.writeFile(txtPath, '', { flag: 'wx' }).catch(() => { }); // wx flag fails if file exists
        }
        await stmt.finalize();
        res.json({ message: `${req.files.length} images uploaded and added to database.` });
    } catch (err) {
        console.error('Error adding uploaded files to DB:', err);
        res.status(500).json({ error: 'Failed to process uploaded files.' });
    }
});

// 6. 获取数据集标签统计
app.get('/api/tags/summary', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    try {
        const summary = await db.all(`
            SELECT 
                t.tag_name as name, 
                t.tag_bcolor as "bg", 
                t.tag_fcolor as "text", 
                COUNT(it.image_id) as count
            FROM tags t
            LEFT JOIN image_tags it ON t.id = it.tag_id
            GROUP BY t.id
            HAVING count > 0
            ORDER BY count DESC, name ASC
        `);
        const formatted = summary.map(t => ({ name: t.name, count: t.count, color: { bg: t.bg, text: t.text } }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get tag summary.' });
    }
});

// 7. 按标签筛选图片
app.get('/api/images/by-tag/:tagName', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    try {
        const images = await db.all(`
            SELECT i.file_path
            FROM images i
            JOIN image_tags it ON i.id = it.image_id
            JOIN tags t ON it.tag_id = t.id
            WHERE t.tag_name = ?
            ORDER BY i.file_path
        `, req.params.tagName);
        res.json({
            data: images.map(img => ({
                name: path.parse(img.file_path).name,
                filename: img.file_path,
                path: `/images/${encodeURIComponent(img.file_path)}`
            }))
        });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch images by tag.' }); }
});

// 8. 重命名图片
app.post('/api/images/:filename/rename', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    const { newName } = req.body;
    const oldFilename = req.params.filename;
    const oldName = path.parse(oldFilename).name;
    const ext = path.parse(oldFilename).ext;
    const newFilename = `${newName}${ext}`;

    if (!newName) return res.status(400).json({ error: 'New name is required.' });

    const oldImagePath = path.join(currentDatasetPath, oldFilename);
    const newImagePath = path.join(currentDatasetPath, newFilename);
    const oldTxtPath = path.join(currentDatasetPath, `${oldName}.txt`);
    const newTxtPath = path.join(currentDatasetPath, `${newName}.txt`);

    try {
        await fs.rename(oldImagePath, newImagePath);
        try { await fs.rename(oldTxtPath, newTxtPath); }
        catch (err) { if (err.code !== 'ENOENT') throw err; } // 如果txt不存在则忽略

        await db.run('UPDATE images SET file_path = ? WHERE file_path = ?', newFilename, oldFilename);
        res.json({ message: 'File renamed successfully.', newFilename });
    } catch (err) {
        console.error("Rename failed:", err);
        res.status(500).json({ error: 'Failed to rename file. Check if the new name is valid or already exists.' });
    }
});

// 删除选中的图片
app.post('/api/images/delete', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    const { filenames } = req.body;
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        return res.status(400).json({ error: 'Filenames array is required.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        const placeholders = filenames.map(() => '?').join(',');
        // 数据库中的 ON DELETE CASCADE 约束会自动删除 image_tags 表中的关联记录
        await db.run(`DELETE FROM images WHERE file_path IN (${placeholders})`, filenames);

        for (const filename of filenames) {
            const imagePath = path.join(currentDatasetPath, filename);
            const txtPath = path.join(currentDatasetPath, `${path.parse(filename).name}.txt`);

            // 删除图片文件
            try {
                await fs.unlink(imagePath);
            } catch (err) {
                // 如果文件已不存在，忽略错误，继续执行
                if (err.code !== 'ENOENT') throw err;
            }

            // 删除 .txt 文件
            try {
                await fs.unlink(txtPath);
            } catch (err) {
                // 如果文件不存在，同样忽略
                if (err.code !== 'ENOENT') throw err;
            }
        }

        await db.run('COMMIT');
        res.json({ message: `${filenames.length} image(s) and associated files have been deleted.` });

    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Error deleting images:', err);
        res.status(500).json({ error: 'Failed to delete images.' });
    }
});

// 9. 更新标签颜色 (全局)
app.post('/api/tags/update-color', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    const { tagName, bcolor, fcolor } = req.body;
    try {
        await db.run('UPDATE tags SET tag_bcolor = ?, tag_fcolor = ? WHERE tag_name = ?', bcolor, fcolor, tagName);
        res.json({ message: 'Tag color updated.' });
    } catch (err) { res.status(500).json({ error: 'Failed to update tag color.' }); }
});

// 10. 删除标签 (全局)
app.delete('/api/tags/:tagName', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    const tagName = req.params.tagName;
    try {
        await db.run('BEGIN TRANSACTION');

        const tag = await db.get('SELECT id FROM tags WHERE tag_name = ?', tagName);
        if (!tag) {
            await db.run('ROLLBACK');
            return res.status(404).json({ error: 'Tag not found.' });
        }

        const affectedImages = await db.all('SELECT i.file_path FROM images i JOIN image_tags it ON i.id = it.image_id WHERE it.tag_id = ?', tag.id);

        for (const image of affectedImages) {
            const txtPath = path.join(currentDatasetPath, `${path.parse(image.file_path).name}.txt`);
            try {
                const content = await fs.readFile(txtPath, 'utf8');
                const tags = content.split(',').map(t => t.trim()).filter(t => t !== tagName);
                await fs.writeFile(txtPath, tags.join(', '));
            } catch (err) { if (err.code !== 'ENOENT') throw err; }
        }

        await db.run('DELETE FROM tags WHERE id = ?', tag.id); // ON DELETE CASCADE 会处理 image_tags

        await db.run('COMMIT');
        res.json({ message: `Tag "${tagName}" was removed from ${affectedImages.length} images.` });
    } catch (err) {
        await db.run('ROLLBACK');
        console.error(`Failed to delete tag ${tagName}:`, err);
        res.status(500).json({ error: 'Failed to delete tag.' });
    }
});

// 11. 全局批量处理标签 (新增/移动/删除)
app.post('/api/tags/batch-process', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized.' });
    
    // action: 'add_start' | 'add_end' | 'delete'
    // tags: string[] (要操作的标签列表)
    const { action, tags } = req.body; 
    
    if (!action || !tags || !Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: 'Invalid parameters.' });
    }

    try {
        console.log(`Starting batch process: ${action} on tags: ${tags.join(', ')}`);
        await db.run('BEGIN TRANSACTION');

        // 1. 获取所有图片
        const allImages = await db.all('SELECT id, file_path FROM images');
        
        // 预处理：确保所有涉及的标签在 tags 表中存在 (用于 add 操作)
        const tagIdMap = new Map(); // tagName -> tagId
        if (action !== 'delete') {
            for (const tagName of tags) {
                const { id } = await db.get(`
                    INSERT INTO tags (tag_name) VALUES (?) 
                    ON CONFLICT(tag_name) DO UPDATE SET tag_name=excluded.tag_name 
                    RETURNING id`, tagName);
                tagIdMap.set(tagName, id);
            }
        }

        // 2. 遍历处理每张图片 (为了保证顺序准确，需要在内存中重组数组)
        let processedCount = 0;

        for (const img of allImages) {
            // 获取当前图片的所有标签 (按顺序)
            const currentTagsRows = await db.all(`
                SELECT t.tag_name, t.id as tag_id
                FROM image_tags it
                JOIN tags t ON it.tag_id = t.id
                WHERE it.image_id = ?
                ORDER BY it."order" ASC
            `, img.id);

            let currentTagNames = currentTagsRows.map(r => r.tag_name);
            let isModified = false;

            if (action === 'delete') {
                const initialLen = currentTagNames.length;
                // 过滤掉要删除的标签
                currentTagNames = currentTagNames.filter(t => !tags.includes(t));
                if (currentTagNames.length !== initialLen) isModified = true;
            } 
            else if (action === 'add_start') {
                // 先移除已存在的这些标签（为了移动到最前），再在头部插入
                const temp = currentTagNames.filter(t => !tags.includes(t));
                // 如果原数组和去掉后的不一样，说明有标签发生了移动，或者如果不包含且我们要添加，也算修改
                // 简单判断：只要最终结果跟原来不一样就需要更新。
                // 构造新数组：[...newTags, ...oldTagsWithoutNewTags]
                const newArr = [...tags, ...temp];
                
                // 检查是否实际上发生了变化 (内容或顺序)
                if (JSON.stringify(newArr) !== JSON.stringify(currentTagNames)) {
                    currentTagNames = newArr;
                    isModified = true;
                }
            } 
            else if (action === 'add_end') {
                // 先移除已存在的这些标签，再在尾部插入
                const temp = currentTagNames.filter(t => !tags.includes(t));
                const newArr = [...temp, ...tags];
                
                if (JSON.stringify(newArr) !== JSON.stringify(currentTagNames)) {
                    currentTagNames = newArr;
                    isModified = true;
                }
            }

            if (isModified) {
                // 3. 更新数据库
                await db.run('DELETE FROM image_tags WHERE image_id = ?', img.id);
                
                for (let i = 0; i < currentTagNames.length; i++) {
                    const tName = currentTagNames[i];
                    // 获取 tagId (如果是 add 操作，map里有；如果是 delete 导致剩下的，可能需要查或重新利用)
                    let tId = tagIdMap.get(tName);
                    
                    if (!tId) {
                        // 这是一个原本就存在但不在本次操作列表中的标签，查一下ID
                        // 优化：其实可以先加载所有 tag map，但这里为了逻辑简单，稍微查库
                        // 更优解：currentTagsRows 里已经有了
                        const existingRow = currentTagsRows.find(r => r.tag_name === tName);
                        if (existingRow) {
                            tId = existingRow.tag_id;
                        } else {
                            // 极少情况：标签表里一定要有
                            const tRow = await db.get('SELECT id FROM tags WHERE tag_name = ?', tName);
                            tId = tRow.id;
                        }
                    }
                    
                    if (tId) {
                        await db.run('INSERT INTO image_tags (image_id, tag_id, "order") VALUES (?, ?, ?)', img.id, tId, i);
                    }
                }

                // 4. 更新 txt 文件
                const txtPath = path.join(currentDatasetPath, `${path.parse(img.file_path).name}.txt`);
                await fs.writeFile(txtPath, currentTagNames.join(', '));
                
                processedCount++;
            }
        }

        await db.run('COMMIT');
        res.json({ message: `全局操作完成。${processedCount} 张图片受到影响并已更新。` });

    } catch (err) {
        await db.run('ROLLBACK');
        console.error('Batch process failed:', err);
        res.status(500).json({ error: 'Failed to process tags globally.' });
    }
});


// --- 主页路由 ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;

    console.log(`Server is running on ${url}`);
    openUrl(url)

    // const url = `http://localhost:${PORT}`;


});

function openUrl(url) {
    let command;
    switch (process.platform) {
        case 'darwin': // macOS
            command = `open ${url}`;
            break;
        case 'win32': // Windows
            command = `start ${url}`;
            break;
        default: // Linux
            command = `xdg-open ${url}`;
            break;
    }
    exec(command);
}