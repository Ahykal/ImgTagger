// public/js/main.js
// HTML 转义，
const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
};
// --- 1. API 调用层 ---
const api = {
    async setDataset(folderPath) {
        const res = await fetch('/api/dataset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath }) });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async getImages(page, pageSize) {
        const res = await fetch(`/api/images?page=${page}&pageSize=${pageSize}`);
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async getImageTags(filename) {
        const res = await fetch(`/api/images/${encodeURIComponent(filename)}/tags`);
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async getTagSummary() {
        const res = await fetch('/api/tags/summary');
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async saveTags(filenames, tags) {
        const res = await fetch('/api/tags/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filenames, tags }) });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async uploadFiles(files) {
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async getImagesByTag(tagName) {
        const res = await fetch(`/api/images/by-tag/${encodeURIComponent(tagName)}`);
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async renameImage(oldFilename, newName) {
        const res = await fetch(`/api/images/${encodeURIComponent(oldFilename)}/rename`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName }) });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async updateTagColor(tagName, bcolor, fcolor) {
        const res = await fetch('/api/tags/update-color', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagName, bcolor, fcolor }) });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async deleteTagGlobally(tagName) {
        const res = await fetch(`/api/tags/${encodeURIComponent(tagName)}`, { method: 'DELETE' });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    async deleteImages(filenames) {
        const res = await fetch('/api/images/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filenames }) });
        if (!res.ok) throw await res.json();
        return res.json();
    },
    // 新增：调用系统弹窗
    async pickSystemFolder() {
        const res = await fetch('/api/system/pick-folder');
        if (!res.ok) throw new Error('无法调用系统窗口');
        return res.json();
    },
    async batchProcessTags(action, tags) {
        const res = await fetch('/api/tags/batch-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, tags })
        });
        if (!res.ok) throw await res.json();
        return res.json();
    }

};

// --- 2. 右键菜单管理器 (已重写和修复) ---
const ContextMenu = {
    element: document.getElementById('context-menu'),
    itemsContainer: document.getElementById('context-menu-items'),

    hideListener: (e) => {
        if (!ContextMenu.element.contains(e.target)) {
            ContextMenu.element.classList.add('hidden');
            window.removeEventListener('click', ContextMenu.hideListener);
            window.removeEventListener('contextmenu', ContextMenu.hideListener);
        }
    },

    show(event, items) {
        event.preventDefault();
        event.stopPropagation();

        this.itemsContainer.innerHTML = '';

        items.forEach(item => {
            const li = document.createElement('li');
            if (item.separator) {
                li.className = 'separator';
            } else {
                li.textContent = item.label;
                li.onclick = () => {
                    this.element.classList.add('hidden');
                    window.removeEventListener('click', this.hideListener);
                    window.removeEventListener('contextmenu', this.hideListener);
                    item.action();
                };
            }
            this.itemsContainer.appendChild(li);
        });

        // const { clientX: mouseX, clientY: mouseY } = event;
        // const { innerWidth, innerHeight } = window;
        // const { offsetWidth: menuWidth, offsetHeight: menuHeight } = this.element;

        // let x = mouseX;
        // let y = mouseY;

        // if (mouseX + menuWidth > innerWidth) x = innerWidth - menuWidth - 5;
        // if (mouseY + menuHeight > innerHeight) y = innerHeight - menuHeight - 5;

        // this.element.style.top = `${y}px`;
        // this.element.style.left = `${x}px`;
        // this.element.classList.remove('hidden');

        // setTimeout(() => {
        //     window.addEventListener('click', this.hideListener);
        //     window.addEventListener('contextmenu', this.hideListener);
        // }, 0);
        // --- [重构] 核心定位逻辑 ---

        // 1. 先移到屏幕外并设为可见，以便测量尺寸
        this.element.style.top = '-9999px';
        this.element.style.left = '-9999px';
        this.element.classList.remove('hidden');

        // 2. 获取真实尺寸和坐标
        const { offsetWidth: menuWidth, offsetHeight: menuHeight } = this.element;
        const { clientX: mouseX, clientY: mouseY } = event;
        const { innerWidth, innerHeight } = window;

        let x = mouseX;
        let y = mouseY;

        // 3. 边界检查和位置修正
        if (mouseX + menuWidth > innerWidth) {
            x = innerWidth - menuWidth - 5; // 靠右边缘对齐，并留5px边距
        }
        if (mouseY + menuHeight > innerHeight) {
            y = innerHeight - menuHeight - 5; // 靠下边缘对齐，并留5px边距
        }

        // 4. 设置最终的正确位置
        this.element.style.top = `${y}px`;
        this.element.style.left = `${x}px`;

        // --- 定位逻辑结束 ---

        setTimeout(() => {
            window.addEventListener('click', this.hideListener);
            window.addEventListener('contextmenu', this.hideListener);
        }, 0);
    }
};

const App = {
    // --- 3. STATE ---
    state: {
        images: [],
        allPageImages: [],
        selectedFilenames: new Set(),
        lastClickedFilename: null,
        pagination: { page: 1, pageSize: 50, totalItems: 0 },
        viewMode: 'list',
        currentImageTags: [],
        tagSearchQuery: '',
        imageFilterQuery: '',
        isFilteredView: false,
        recentDatasets: JSON.parse(localStorage.getItem('recentDatasets') || '[]'),
        selectedTagNames: new Set(), // 新增：中间栏被选中的标签名集合
        lastClickedTagName: null,    // 新增：用于 shift 多选

    },

    // --- 4. UI RENDER METHODS ---
    ui: {
        renderImages() {
            const listBody = document.getElementById('image-tbody');
            const gridContainer = document.getElementById('image-grid');

            // 1. 准备数据
            const imageSource = App.state.isFilteredView ? App.state.images : App.state.allPageImages;
            const query = App.state.imageFilterQuery.toLowerCase();
            const filteredImages = query
                ? imageSource.filter(img => img.filename.toLowerCase().includes(query))
                : imageSource;

            // 2. 生成列表视图 HTML (极大提升大列表渲染速度)
            const listHtml = filteredImages.map(img => {
                const isSelected = App.state.selectedFilenames.has(img.filename);
                return `
                <tr class="image-row ${isSelected ? 'selected' : ''}" data-filename="${escapeHtml(img.filename)}">
                    <td class="col-checkbox"><input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''}></td>
                    <td class="col-thumb"><img src="${escapeHtml(img.path)}" loading="lazy"></td>
                    <td class="col-name"><span class="editable-name">${escapeHtml(img.name)}</span></td>
                </tr>`;
            }).join('');

            // 3. 生成网格视图 HTML
            const gridHtml = filteredImages.map(img => {
                const isSelected = App.state.selectedFilenames.has(img.filename);
                return `
                <div class="grid-item ${isSelected ? 'selected' : ''}" data-filename="${escapeHtml(img.filename)}">
                    <div class="grid-item-thumb-wrapper">
                        <img src="${escapeHtml(img.path)}" loading="lazy">
                        <input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''}>
                    </div>
                    <div class="grid-item-name">
                        <span class="editable-name">${escapeHtml(img.name)}</span>
                    </div>
                </div>`;
            }).join('');

            // 4. 一次性写入 DOM
            listBody.innerHTML = listHtml;
            gridContainer.innerHTML = gridHtml;

            this.updateSelectionInfo();
        },
        // renderSelectedTags(tags) {
        //     App.state.currentImageTags = tags;
        //     const list = document.getElementById('selected-tags-list');

        //     // 使用字符串模板。注意：保留了 tag-drag-handle 用于拖拽
        //     // 添加了 remove-btn 方便用户快速删除
        //     list.innerHTML = tags.map(tag => `
        //         <li class="tag-item" data-tag-name="${escapeHtml(tag.name)}" style="background-color: ${tag.color.bg}; color: ${tag.color.text};">
        //             <span class="tag-drag-handle">☰</span>
        //             <span  class="editable-tag" style="flex:1">${escapeHtml(tag.name.replace(/_/g, ' '))}</span>
        //             <span class="tag-name" translate="yes" style="flex:1">${escapeHtml(tag.name.replace(/_/g, ' '))}</span>
        //         </li>
        //     `).join('');
        //     //<span class="remove-btn" title="移除标签" style="cursor:pointer; margin-left:8px; opacity:0.6;">×</span>
        //     this.updateTextareaFromTags();
        // },
        renderSelectedTags(tags) {
            App.state.currentImageTags = tags;
            const list = document.getElementById('selected-tags-list');

            // 极速优化：将 Set 引用提取到循环外，避免每次循环都进行对象属性查找 (App -> state -> selectedTagNames)
            const selectedSet = App.state.selectedTagNames;

            // 直接在 map 中返回模板字符串，移除所有函数体内变量
            list.innerHTML = tags.map(tag => `
        <li class="tag-item ${selectedSet.has(tag.name) ? 'selected-tag' : ''}" 
            data-tag-name="${escapeHtml(tag.name)}" 
            style="background-color: ${tag.color.bg}; color: ${tag.color.text};">
            <span class="tag-drag-handle">☰</span>
            <input type="checkbox" class="tag-checkbox" ${selectedSet.has(tag.name) ? 'checked' : ''}>
            <span class="editable-tag" style="flex:1;">${escapeHtml(tag.name.replace(/_/g, ' '))}</span>
            <span class="tag-name" translate="yes" style="flex:1">${escapeHtml(tag.name.replace(/_/g, ' '))}</span>
        </li>`).join('');

            this.updateTextareaFromTags();
        },


        async renderDatasetTags() {
            try {
                const tags = await api.getTagSummary();
                // 缓存数据以便后续使用（可选优化，看需求）
                // App.state.allTagsCache = tags; 

                const query = App.state.tagSearchQuery.toLowerCase();
                const filteredTags = tags.filter(t => t.name.toLowerCase().includes(query));

                const list = document.getElementById('all-tags-list');

                // 极速渲染
                list.innerHTML = filteredTags.map(tag => `
                    <li class="tag-item"  data-tag-name="${escapeHtml(tag.name)}" style="background-color: ${tag.color.bg}; color: ${tag.color.text};">
                        <span class="tag-name" style="flex:1">${escapeHtml(tag.name.replace(/_/g, ' '))}</span>
                        <span class="tag-name" translate="yes" style="flex:1">${escapeHtml(tag.name.replace(/_/g, ' '))}</span>
                        <span class="tag-count" style="width:10px">${tag.count}</span>
                    </li>
                `).join('');

            } catch (err) {
                console.error("Failed to render dataset tags:", err);
            }
        },
        updatePaginationInfo() {
            const { page, totalItems, pageSize } = App.state.pagination;
            const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
            document.getElementById('page-info').textContent = `Page ${totalPages > 0 ? page : 0} / ${totalPages}`;
            document.getElementById('btn-prev').disabled = page <= 1;
            document.getElementById('btn-next').disabled = page >= totalPages;
        },
        updateSelectionInfo() {
            const count = App.state.selectedFilenames.size;
            const statusElem = document.getElementById('dataset-status');
            const imageSource = App.state.isFilteredView ? App.state.images : App.state.allPageImages;
            if (App.state.isFilteredView) {
                statusElem.textContent = `筛选结果: ${imageSource.length} 张图片`;
            } else {
                statusElem.textContent = `已选 ${count} / ${imageSource.length} 项`;
            }
        },
        updateTextareaFromTags() {
            const tagNames = App.state.currentImageTags.map(t => t.name);
            document.getElementById('tags-textarea').value = tagNames.join(', ');
        },
        updateTagsFromTextarea() {
            const text = document.getElementById('tags-textarea').value.trim();
            const tagNames = text ? text.split(/,\s*/g).map(s => s.trim()).filter(Boolean) : [];
            const newTags = tagNames.map(name => {
                const existing = App.state.currentImageTags.find(t => t.name === name);
                return existing || { name, color: { bg: '#eee', text: '#333' } };
            });
            this.renderSelectedTags(newTags);
        },
        updateThumbnailSize(size) {
            document.documentElement.style.setProperty('--thumbnail-size', `${size}px`);
        }
    },

    // --- 5. INITIALIZATION & EVENTS ---
    init() {
        this.bindGlobalEvents();
        this.bindPanelEvents();
        this.bindMenuEvents(); // 新增菜单事件绑定
        this.initLibraries();
        this.ui.updateThumbnailSize(document.getElementById('zoom-slider').value);
        // 渲染一次历史记录菜单
        this.renderHistoryMenu();

        // document.querySelector('.main-menu a').addEventListener('click', (e) => {
        //     e.preventDefault();
        //     App.methods.selectDataset();
        // });
    },

    bindMenuEvents() {
        const fileTrigger = document.getElementById('menu-file-trigger');
        const fileDropdown = document.getElementById('menu-file-dropdown');
        const openBtn = document.getElementById('menu-open-dataset');

        // 1. 点击“文件”切换下拉菜单
        fileTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropdown.classList.toggle('show');
        });

        // 2. 点击“打开数据集...”
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileDropdown.classList.remove('show'); // 关闭菜单
            App.methods.selectDatasetWithDialog(); // 调用新方法
        });

        // 3. 点击页面其他地方关闭菜单
        window.addEventListener('click', () => {
            if (fileDropdown.classList.contains('show')) {
                fileDropdown.classList.remove('show');
            }
        });

        const translationToggle = document.getElementById('translation-toggle');
        translationToggle.addEventListener('change', (e) => {
            // 如果复选框被选中，则移除 hide-translation 类 (显示翻译)
            // 如果未被选中，则添加 hide-translation 类 (隐藏翻译)
            if (e.target.checked) {
                document.body.classList.remove('hide-translation');
            } else {
                document.body.classList.add('hide-translation');
            }
        });
    },

    renderHistoryMenu() {
        const dropdown = document.getElementById('menu-file-dropdown');
        // 保留前两个固定元素（"打开..." 和 分隔线）
        const staticItems = Array.from(dropdown.children).slice(0, 2);
        dropdown.innerHTML = '';
        staticItems.forEach(item => dropdown.appendChild(item));

        // 添加“最近使用”标签
        const label = document.createElement('li');
        label.className = 'history-label';
        label.textContent = '最近使用:';
        dropdown.appendChild(label);

        if (App.state.recentDatasets.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'disabled';
            empty.textContent = '无历史记录';
            dropdown.appendChild(empty);
        } else {
            App.state.recentDatasets.forEach(path => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.textContent = path;
                a.title = path; // 鼠标悬停显示全路径
                a.href = "#";
                a.onclick = (e) => {
                    e.preventDefault();
                    dropdown.classList.remove('show');
                    App.methods.loadDatasetByPath(path);
                };
                li.appendChild(a);
                dropdown.appendChild(li);
            });

            // 添加一个清除历史的选项
            const clearDivider = document.createElement('li');
            clearDivider.className = 'separator';
            dropdown.appendChild(clearDivider);

            const clearLi = document.createElement('li');
            const clearA = document.createElement('a');
            clearA.textContent = '🗑️ 清除历史记录';
            clearA.onclick = (e) => {
                e.preventDefault();
                App.state.recentDatasets = [];
                localStorage.removeItem('recentDatasets');
                App.renderHistoryMenu();
            };
            clearLi.appendChild(clearA);
            dropdown.appendChild(clearLi);
        }
    },

    initLibraries() {
        Split(['#image-list-panel', '#selected-tags-panel', '#all-tags-panel'], {
            sizes: [50, 25, 25], minSize: 280, gutterSize: 8,
        });

        const tagList = document.getElementById('selected-tags-list');
        new Sortable(tagList, {
            handle: '.tag-drag-handle', animation: 150,
            onEnd: (evt) => {
                const movedTag = App.state.currentImageTags.splice(evt.oldIndex, 1)[0];
                App.state.currentImageTags.splice(evt.newIndex, 0, movedTag);
                App.ui.updateTextareaFromTags();
            }
        });
    },

    bindGlobalEvents() {
        const dropOverlay = document.getElementById('drop-zone-overlay');
        document.body.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) {
                dropOverlay.classList.remove('hidden');
            }
        });
        document.body.addEventListener('dragleave', (e) => {
            if (e.relatedTarget === null || e.target === document.body) {
                dropOverlay.classList.add('hidden');
            }
        });
        document.body.addEventListener('drop', (e) => {
            e.preventDefault();
            dropOverlay.classList.add('hidden');
            const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                App.methods.addFiles(files);
            }
        });
    },

    bindPanelEvents() {
        // Left Panel
        document.getElementById('image-display-area').addEventListener('click', (e) => App.methods.handleImageClick(e));
        document.getElementById('image-display-area').addEventListener('contextmenu', (e) => App.methods.handleImageContextMenu(e));
        document.getElementById('select-all-checkbox').addEventListener('change', (e) => App.methods.selectAll(e.target.checked));
        document.getElementById('btn-view-list').addEventListener('click', () => App.methods.setViewMode('list'));
        document.getElementById('btn-view-grid').addEventListener('click', () => App.methods.setViewMode('grid'));
        document.getElementById('zoom-slider').addEventListener('input', (e) => App.ui.updateThumbnailSize(e.target.value));
        document.getElementById('image-display-area').addEventListener('dblclick', (e) => { const span = e.target.closest('.editable-name'); if (span) App.methods.startEditing(span, 'name'); });
        document.getElementById('btn-prev').addEventListener('click', () => App.methods.changePage(-1));
        document.getElementById('btn-next').addEventListener('click', () => App.methods.changePage(1));
        document.getElementById('image-filter-input').addEventListener('input', (e) => {
            App.state.imageFilterQuery = e.target.value;
            App.ui.renderImages();
        });

        // Middle Panel
        // document.getElementById('tags-textarea').addEventListener('input', () => { clearTimeout(App.textareaTimeout); App.textareaTimeout = setTimeout(() => App.ui.updateTagsFromTextarea(), 300); });
         document.getElementById('tags-textarea').addEventListener('blur', () => App.ui.updateTagsFromTextarea());
        
        document.getElementById('selected-tags-list').addEventListener('dblclick', (e) => { const span = e.target.closest('.editable-tag'); if (span) App.methods.startEditing(span, 'tag'); });
        document.getElementById('selected-tags-list').addEventListener('contextmenu', (e) => App.methods.handleSelectedTagContextMenu(e));
        document.getElementById('btn-save-tags').addEventListener('click', () => App.methods.saveTags());
        document.getElementById('btn-global-add-start').addEventListener('click', () => App.methods.handleGlobalButton('add_start'));
        document.getElementById('btn-global-add-end').addEventListener('click', () => App.methods.handleGlobalButton('add_end'));
        document.getElementById('btn-global-delete').addEventListener('click', () => App.methods.handleGlobalButton('delete'));
        document.getElementById('selected-tags-list').addEventListener('click', (e) => App.methods.handleTagClick(e));

        // Right Panel
        const allTagsList = document.getElementById('all-tags-list');
        document.getElementById('tag-search-input').addEventListener('input', (e) => {
            App.state.tagSearchQuery = e.target.value;
            App.ui.renderDatasetTags();
        });
        allTagsList.addEventListener('contextmenu', (e) => App.methods.handleAllTagsContextMenu(e));
        allTagsList.addEventListener('dblclick', (e) => {
            const li = e.target.closest('li.tag-item'); if (!li) return;
            App.methods.addTagToCurrentImage(li.dataset.tagName);
        });
    },

    // --- 6. METHODS (BUSINESS LOGIC) ---
    methods: {
        // async selectDataset() {
        //     const folderPath = prompt("请输入数据集文件夹的绝对路径 (包含图片和txt文件的目录):", "");
        //     if (folderPath && folderPath.trim() !== '') {
        //         try {
        //             const result = await api.setDataset(folderPath.trim());
        //             alert(result.message);
        //             await this.loadImages(1);
        //             await App.ui.renderDatasetTags();
        //         } catch (err) {
        //             alert('设置数据集失败: ' + (err.error || '请查看服务器控制台日志'));
        //         }
        //     }
        // },
        // 新增：通过系统弹窗选择数据集
        async selectDatasetWithDialog() {
            try {
                // 调用后端打开 Windows 文件夹选择框
                const result = await api.pickSystemFolder();

                if (result.canceled) {
                    console.log("用户取消了选择");
                    return;
                }

                if (result.path) {
                    await this.loadDatasetByPath(result.path);
                }
            } catch (err) {
                console.error(err);
                // 如果系统弹窗失败（例如非Windows环境），回退到 prompt
                alert("无法打开系统窗口，将使用手动输入模式。");
                this.selectDataset(); // 回退到旧方法
            }
        },

        // 重构：将加载逻辑抽离，方便历史记录调用
        async loadDatasetByPath(folderPath) {
            if (!folderPath) return;

            try {
                const result = await api.setDataset(folderPath);
                alert(result.message); // 或者使用更优雅的 toast

                // 更新历史记录
                this.addToHistory(folderPath);

                // 加载数据
                await this.loadImages(1);
                await App.ui.renderDatasetTags();
            } catch (err) {
                alert('加载数据集失败: ' + (err.error || '未知错误'));
            }
        },

        addToHistory(path) {
            // 移除重复项，并将最新的放到最前
            let history = App.state.recentDatasets.filter(p => p !== path);
            history.unshift(path);
            // 只保留最近 10 条
            history = history.slice(0, 10);

            App.state.recentDatasets = history;
            localStorage.setItem('recentDatasets', JSON.stringify(history));
            App.renderHistoryMenu(); // 刷新菜单
        },
        async loadImages(page) {
            try {
                const pageSize = App.state.pagination.pageSize;
                const res = await api.getImages(page, pageSize);
                App.state.allPageImages = res.data;
                App.state.images = res.data;
                App.state.pagination.page = page;
                App.state.pagination.totalItems = res.total;
                App.state.isFilteredView = false;

                const status = document.getElementById('dataset-status');
                status.classList.remove('filtered');
                status.onclick = null;

                App.ui.renderImages();
                App.ui.updatePaginationInfo();
            } catch (err) {
                console.error("加载图片失败", err);
            }
        },
        async changePage(delta) {
            const { page, totalItems, pageSize } = App.state.pagination;
            const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
            const newPage = page + delta;
            if (newPage > 0 && newPage <= totalPages) {
                await this.loadImages(newPage);
            }
        },
        async addFiles(files) {
            // [重构] 彻底重写此函数以处理文件名冲突
            const filesToUpload = [];
            const existingFilenames = new Set(App.state.allPageImages.map(img => img.filename));

            for (const file of files) {
                let finalName = file.name;
                let isNameConflict = existingFilenames.has(finalName);

                if (isNameConflict) {
                    const { name, ext } = path.parse(file.name);
                    let i = 1;
                    let suggestedName;
                    // 循环直到找到一个不冲突的建议名称
                    do {
                        suggestedName = `${name}_${i++}${ext}`;
                    } while (existingFilenames.has(suggestedName));

                    const userInput = prompt(
                        `文件名冲突: "${file.name}" 已存在。\n请为文件提供一个新名称，或点击“取消”跳过此文件。`,
                        suggestedName
                    );

                    if (userInput === null) {
                        // 用户点击了 "取消"，跳过这个文件
                        console.log(`已跳过上传: ${file.name}`);
                        continue;
                    }

                    finalName = userInput.trim();
                    if (!finalName) {
                        alert("文件名不能为空，已跳过此文件。");
                        continue;
                    }
                }

                // 使用 File 构造函数创建一个具有新名称的新文件对象
                // 因为原始的 File 对象是不可变的
                const finalFile = new File([file], finalName, { type: file.type });
                filesToUpload.push(finalFile);
            }

            if (filesToUpload.length > 0) {
                try {
                    const result = await api.uploadFiles(filesToUpload);
                    alert(result.message);
                    await this.loadImages(1); // 上传成功后，刷新
                    await App.ui.renderDatasetTags();
                } catch (err) {
                    alert('上传文件失败: ' + (err.error || '请查看服务器控制台日志'));
                }
            }
            // try {
            //     const result = await api.uploadFiles(files);
            //     alert(result.message);
            //     await this.loadImages(1);
            //     await App.ui.renderDatasetTags();
            // } catch (err) { 
            //     alert('上传文件失败: ' + (err.error || '请查看服务器控制台日志')); 
            // }
        },
        handleImageClick(e) {
            const item = e.target.closest('.image-row, .grid-item');
            if (!item) return;

            const filename = item.dataset.filename;

            if (e.shiftKey && App.state.lastClickedFilename) {
                const allVisibleItems = [...document.querySelectorAll('[data-filename]')].filter(el => el.offsetParent !== null);
                const filenames = allVisibleItems.map(i => i.dataset.filename);
                const start = filenames.indexOf(App.state.lastClickedFilename);
                const end = filenames.indexOf(filename);

                if (start !== -1 && end !== -1) {
                    const filesToSelect = filenames.slice(Math.min(start, end), Math.max(start, end) + 1);
                    if (!e.ctrlKey) {
                        App.state.selectedFilenames.clear();
                    }
                    filesToSelect.forEach(fname => App.state.selectedFilenames.add(fname));
                }
            }
            else if (e.ctrlKey) {
                if (App.state.selectedFilenames.has(filename)) {
                    App.state.selectedFilenames.delete(filename);
                } else {
                    App.state.selectedFilenames.add(filename);
                }
            }
            else {
                App.state.selectedFilenames.clear();
                App.state.selectedFilenames.add(filename);
            }

            App.state.lastClickedFilename = filename;
            App.ui.renderImages();

            if (App.state.selectedFilenames.size === 1) {
                const singleSelectedFile = App.state.selectedFilenames.values().next().value;
                this.loadTagsForImage(singleSelectedFile);
            } else {
                this.loadTagsForImage(null);
            }
        },
        selectAll(isSelected) {
            const imageSource = App.state.isFilteredView ? App.state.images : App.state.allPageImages;
            if (isSelected) {
                imageSource.forEach(img => App.state.selectedFilenames.add(img.filename));
            } else {
                App.state.selectedFilenames.clear();
            }
            App.ui.renderImages();
        },
        async loadTagsForImage(filename) {
            try {
                const tags = filename ? await api.getImageTags(filename) : [];
                App.ui.renderSelectedTags(tags);
            } catch (err) {
                console.error(`加载标签失败 for ${filename}:`, err);
            }
        },
        async saveTags() {
            const filenames = [...App.state.selectedFilenames];
            if (filenames.length === 0) {
                alert("没有选中任何图片。");
                return;
            }
            const tagsToSave = App.state.currentImageTags;
            const button = document.getElementById('btn-save-tags');

            try {
                button.textContent = '保存中...';
                button.disabled = true;

                const result = await api.saveTags(filenames, tagsToSave);
                alert(result.message);

                await App.ui.renderDatasetTags();
            } catch (err) {
                alert("保存失败: " + (err.error || '请查看服务器控制台日志'));
            } finally {
                button.textContent = '保存';
                button.disabled = false;
            }
        },
        setViewMode(mode) {
            App.state.viewMode = mode;
            document.getElementById('image-list-panel').className = `panel ${mode}-view`;
            document.getElementById('btn-view-list').classList.toggle('active', mode === 'list');
            document.getElementById('btn-view-grid').classList.toggle('active', mode === 'grid');
        },
        startEditing(span, context) {
            const originalText = span.textContent;
            const li = span.closest('li');
            const originalTagName = li ? li.dataset.tagName : null;

            const input = document.createElement('input');
            input.type = 'text'; input.className = 'edit-input'; input.value = originalText; input.style = "flex:1";
            span.style.display = 'none'; span.parentNode.insertBefore(input, span); input.focus();

            const finishEditing = () => {
                const newText = input.value.trim().replace(/,/g, '_');
                input.parentNode.removeChild(input);
                span.style.display = '';

                if (newText && newText !== originalText) {
                    span.textContent = newText;
                    if (context === 'tag' && originalTagName) {
                        const tagToUpdate = App.state.currentImageTags.find(t => t.name === originalTagName);
                        if (tagToUpdate) {
                            tagToUpdate.name = newText;
                            App.ui.renderSelectedTags(App.state.currentImageTags);
                        }
                    }
                } else {
                    span.textContent = originalText;
                }
            };

            input.addEventListener('blur', finishEditing);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEditing();
                if (e.key === 'Escape') { input.value = originalText; finishEditing(); }
            });
        },
        async addTagToCurrentImage(tagName) {
            if (App.state.selectedFilenames.size === 0) { alert("请先选择一张图片"); return; }
            if (App.state.selectedFilenames.size > 1) { alert("多选状态下无法直接添加单个标签，请使用保存功能批量覆盖。"); return; }
            const tagExists = App.state.currentImageTags.some(t => t.name === tagName);
            if (tagExists) return;

            const allTags = await api.getTagSummary();
            const tagInfo = allTags.find(t => t.name === tagName) || { name: tagName, color: { bg: '#eee', text: '#333' } };

            App.state.currentImageTags.push(tagInfo);
            App.ui.renderSelectedTags(App.state.currentImageTags);
        },
        getColorInput(initialColor) {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = initialColor;

                const onSelect = () => {
                    resolve(input.value);
                    document.body.removeChild(input);
                };
                const onCancel = () => {
                    resolve(null); // Resolve with null if cancelled
                    document.body.removeChild(input);
                };

                input.addEventListener('change', onSelect, { once: true });
                input.addEventListener('blur', onCancel, { once: true });

                input.style.position = 'fixed';
                input.style.top = '-100px';
                document.body.appendChild(input);
                input.click();
            });
        },
        // async handleImageContextMenu(e) {
        //     const item = e.target.closest('.image-row, .grid-item');
        //     if (!item) return;
        //     e.preventDefault();
        //     const filename = item.dataset.filename;
        //     const oldName = path.parse(filename).name;

        //     const menuItems = [
        //         {
        //             label: `重命名 "${oldName}"...`,
        //             action: () => {
        //                 const newName = prompt(`重命名文件 "${filename}":`, oldName);
        //                 if (newName && newName.trim() !== '' && newName !== oldName) {
        //                     this.renameImage(filename, newName.trim());
        //                 }
        //             }
        //         }
        //     ];
        //     ContextMenu.show(e, menuItems);
        // },
        async deleteImages(filenames) {
            try {
                const result = await api.deleteImages(filenames);
                alert(result.message);
                // 删除后清空选择并刷新当前页
                App.state.selectedFilenames.clear();
                await this.loadImages(App.state.pagination.page);
                await App.ui.renderDatasetTags(); // 标签统计可能也变了
            } catch (err) {
                alert('删除失败: ' + (err.error || '未知错误'));
            }
        },
        async handleImageContextMenu(e) {
            const item = e.target.closest('.image-row, .grid-item');
            if (!item) return;
            e.preventDefault();

            const filename = item.dataset.filename;
            const selectedCount = App.state.selectedFilenames.size;

            // 如果右键点击的项目不在已选中的项目里，则强制单选该项
            if (!App.state.selectedFilenames.has(filename)) {
                App.state.selectedFilenames.clear();
                App.state.selectedFilenames.add(filename);
                App.ui.renderImages();
            }

            const menuItems = [];

            // 只有当选中项为1时，才显示“重命名”
            if (selectedCount === 1 || (selectedCount === 0 && filename)) {
                const nameToRename = selectedCount === 1 ? App.state.selectedFilenames.values().next().value : filename;
                const oldName = path.parse(nameToRename).name;
                menuItems.push({
                    label: `重命名 "${oldName}"...`,
                    action: () => {
                        const newName = prompt(`重命名文件 "${nameToRename}":`, oldName);
                        if (newName && newName.trim() !== '' && newName !== oldName) {
                            this.renameImage(nameToRename, newName.trim());
                        }
                    }
                });
                menuItems.push({ separator: true });
            }

            // 添加删除选项
            const filesToDelete = [...App.state.selectedFilenames];
            if (filesToDelete.length > 0) {
                menuItems.push({
                    label: `删除选中的 ${filesToDelete.length} 张图片...`,
                    action: () => {
                        if (confirm(`警告：此操作将从硬盘和数据库中永久删除 ${filesToDelete.length} 张图片及其标签文件！\n此操作不可恢复，确定要继续吗？`)) {
                            this.deleteImages(filesToDelete);
                        }
                    }
                });
            }

            if (menuItems.length > 0) {
                ContextMenu.show(e, menuItems);
            }
        },
        async renameImage(oldFilename, newName) {
            try {
                await api.renameImage(oldFilename, newName);
                await this.loadImages(App.state.pagination.page);
            } catch (err) { alert('重命名失败: ' + (err.error || '未知错误')); }
        },
        // async handleSelectedTagContextMenu(e) {
        //     const li = e.target.closest('li.tag-item');
        //     if (!li) return;
        //     e.preventDefault();

        //     const tagName = li.dataset.tagName;
        //     const tag = App.state.currentImageTags.find(t => t.name === tagName);
        //     if (!tag) return;

        //     const menuItems = [
        //         {
        //             label: '修改背景色 (全局)...',
        //             action: async () => {
        //                 const newColor = await this.getColorInput(tag.color.bg);
        //                 if (newColor) {
        //                     await api.updateTagColor(tagName, newColor, tag.color.text);
        //                     await App.ui.renderDatasetTags();
        //                     if (App.state.selectedFilenames.size > 0) {
        //                         await this.loadTagsForImage(App.state.lastClickedFilename);
        //                     }
        //                 }
        //             }
        //         },
        //         {
        //             label: '修改前景色 (全局)...',
        //             action: async () => {
        //                 const newColor = await this.getColorInput(tag.color.text);
        //                 if (newColor) {
        //                     await api.updateTagColor(tagName, tag.color.bg, newColor);
        //                     await App.ui.renderDatasetTags();
        //                     if (App.state.selectedFilenames.size > 0) {
        //                         await this.loadTagsForImage(App.state.lastClickedFilename);
        //                     }
        //                 }
        //             }
        //         },
        //         { separator: true },
        //         {
        //             label: '从当前图片删除此标签',
        //             action: () => {
        //                 App.state.currentImageTags = App.state.currentImageTags.filter(t => t.name !== tagName);
        //                 App.ui.renderSelectedTags(App.state.currentImageTags);
        //             }
        //         },
        //         {
        //             label: '添加新标签...',
        //             action: () => {
        //                 const newTagName = prompt("输入新标签名:");
        //                 if (newTagName && !App.state.currentImageTags.some(t => t.name === newTagName)) {
        //                     this.addTagToCurrentImage(newTagName);
        //                 }
        //             }
        //         }
        //     ];
        //     ContextMenu.show(e, menuItems);
        // },
        // 新增：处理标签点击（多选逻辑）
        handleTagClick(e) {
            // 如果点击的是编辑框或拖拽手柄，忽略
            if (e.target.classList.contains('editable-tag') && e.target.tagName === 'INPUT') return;
            if (e.target.classList.contains('tag-drag-handle')) return;

            const li = e.target.closest('li.tag-item');
            if (!li) return;

            const tagName = li.dataset.tagName;

            // 如果点击的是 checkbox，直接切换该项
            if (e.target.classList.contains('tag-checkbox')) {
                if (App.state.selectedTagNames.has(tagName)) {
                    App.state.selectedTagNames.delete(tagName);
                } else {
                    App.state.selectedTagNames.add(tagName);
                }
                App.state.lastClickedTagName = tagName;
                App.ui.renderSelectedTags(App.state.currentImageTags);
                return;
            }

            // 普通点击逻辑 (仿造左侧栏)
            if (e.shiftKey && App.state.lastClickedTagName) {
                const tags = App.state.currentImageTags.map(t => t.name);
                const start = tags.indexOf(App.state.lastClickedTagName);
                const end = tags.indexOf(tagName);

                if (start !== -1 && end !== -1) {
                    const subset = tags.slice(Math.min(start, end), Math.max(start, end) + 1);
                    if (!e.ctrlKey) App.state.selectedTagNames.clear();
                    subset.forEach(t => App.state.selectedTagNames.add(t));
                }
            } else if (e.ctrlKey) {
                if (App.state.selectedTagNames.has(tagName)) {
                    App.state.selectedTagNames.delete(tagName);
                } else {
                    App.state.selectedTagNames.add(tagName);
                }
            } else {
                // 单击且无修饰键：这里为了方便编辑文本，通常点击行不应该清空多选，
                // 但为了保持一致性，单击行空白处可以视为单选。
                // 如果用户想编辑文本，需要双击。
                App.state.selectedTagNames.clear();
                App.state.selectedTagNames.add(tagName);
            }

            App.state.lastClickedTagName = tagName;
            App.ui.renderSelectedTags(App.state.currentImageTags);
        },

        // 新增：处理顶部3个按钮的全局操作
        async handleGlobalButton(action) {
            let inputLabel = '';
            if (action === 'add_start') inputLabel = "全局增加标签到首位 (逗号分隔):";
            if (action === 'add_end') inputLabel = "全局增加标签到末位 (逗号分隔):";
            if (action === 'delete') inputLabel = "全局删除标签 (逗号分隔):";

            const input = prompt(inputLabel);
            if (!input || !input.trim()) return;

            const tags = input.split(/,|，/).map(t => t.trim()).filter(Boolean);
            if (tags.length === 0) return;

            if (!confirm(`确定要对所有图片执行 "${action}" 操作吗？\n涉及标签: ${tags.join(', ')}`)) return;

            try {
                const result = await api.batchProcessTags(action, tags);
                alert(result.message);
                // 刷新当前视图
                if (App.state.selectedFilenames.size > 0) {
                    await this.loadTagsForImage(App.state.lastClickedFilename);
                }
                await App.ui.renderDatasetTags();
            } catch (err) {
                alert('操作失败: ' + (err.error || '未知错误'));
            }
        },
        async handleSelectedTagContextMenu(e) {
            const li = e.target.closest('li.tag-item');
            if (!li) return;
            e.preventDefault();

            const tagName = li.dataset.tagName;

            // 确保右键点击的项在选中集合中，如果不在，则单选它
            if (!App.state.selectedTagNames.has(tagName)) {
                App.state.selectedTagNames.clear();
                App.state.selectedTagNames.add(tagName);
                App.ui.renderSelectedTags(App.state.currentImageTags);
            }

            const selectedTagsList = [...App.state.selectedTagNames];
            const count = selectedTagsList.length;

            const menuItems = [
                {
                    label: `删除选中的 ${count} 个标签 (当前图片)`,
                    action: () => {
                        // 从当前 currentImageTags 中移除
                        App.state.currentImageTags = App.state.currentImageTags.filter(t => !App.state.selectedTagNames.has(t.name));
                        App.state.selectedTagNames.clear();
                        App.ui.renderSelectedTags(App.state.currentImageTags);
                        // 注意：这里仅修改了UI状态，用户需要点“保存”按钮才会持久化
                    }
                },
                { separator: true },
                {
                    label: `全局删除选中标签 (${count}个)...`,
                    action: async () => {
                        if (confirm(`确定要从数据库所有图片中删除这 ${count} 个标签吗？`)) {
                            await api.batchProcessTags('delete', selectedTagsList);
                            // 刷新
                            App.state.selectedTagNames.clear();
                            if (App.state.selectedFilenames.size > 0) await this.loadTagsForImage(App.state.lastClickedFilename);
                            await App.ui.renderDatasetTags();
                        }
                    }
                },
                {
                    label: `全局新增并移动选中到首位 (${count}个)...`,
                    action: async () => {
                        if (confirm(`确定要在所有图片中将这 ${count} 个标签移动/添加到首位吗？`)) {
                            await api.batchProcessTags('add_start', selectedTagsList);
                            if (App.state.selectedFilenames.size > 0) await this.loadTagsForImage(App.state.lastClickedFilename);
                            await App.ui.renderDatasetTags();
                        }
                    }
                },
                {
                    label: `全局新增并移动选中到末位 (${count}个)...`,
                    action: async () => {
                        if (confirm(`确定要在所有图片中将这 ${count} 个标签移动/添加到末位吗？`)) {
                            await api.batchProcessTags('add_end', selectedTagsList);
                            if (App.state.selectedFilenames.size > 0) await this.loadTagsForImage(App.state.lastClickedFilename);
                            await App.ui.renderDatasetTags();
                        }
                    }
                },
                { separator: true },
                // ... 保留原有的颜色修改功能 (只针对单个点击的，或者针对所有选中的？通常改颜色是针对单个标签定义的)
                // 这里为了简单，如果只选了一个，显示颜色修改；选了多个隐藏
            ];

            if (count === 1) {
                const tag = App.state.currentImageTags.find(t => t.name === tagName);
                if (tag) {
                    menuItems.push({
                        label: '修改背景色 (全局)...',
                        action: async () => {
                            const newColor = await this.getColorInput(tag.color.bg);
                            if (newColor) {
                                await api.updateTagColor(tagName, newColor, tag.color.text);
                                await App.ui.renderDatasetTags();
                                if (App.state.selectedFilenames.size > 0) await this.loadTagsForImage(App.state.lastClickedFilename);
                            }
                        }
                    });
                    menuItems.push({
                        label: '修改前景色 (全局)...',
                        action: async () => {
                            const newColor = await this.getColorInput(tag.color.text);
                            if (newColor) {
                                await api.updateTagColor(tagName, tag.color.bg, newColor);
                                await App.ui.renderDatasetTags();
                                if (App.state.selectedFilenames.size > 0) await this.loadTagsForImage(App.state.lastClickedFilename);
                            }
                        }
                    });
                }
            }

            ContextMenu.show(e, menuItems);
        },
        async handleAllTagsContextMenu(e) {
            const li = e.target.closest('li.tag-item');
            if (!li) return;
            e.preventDefault();

            const tagName = li.dataset.tagName;
            const allTags = await api.getTagSummary();
            const tag = allTags.find(t => t.name === tagName);
            if (!tag) return;

            const menuItems = [
                {
                    label: '修改背景色 (全局)...',
                    action: async () => {
                        const newColor = await this.getColorInput(tag.color.bg);
                        if (newColor) {
                            await api.updateTagColor(tagName, newColor, tag.color.text);
                            await App.ui.renderDatasetTags();
                            if (App.state.selectedFilenames.size > 0) {
                                await this.loadTagsForImage(App.state.lastClickedFilename);
                            }
                        }
                    }
                },
                {
                    label: '修改前景色 (全局)...',
                    action: async () => {
                        const newColor = await this.getColorInput(tag.color.text);
                        if (newColor) {
                            await api.updateTagColor(tagName, tag.color.bg, newColor);
                            await App.ui.renderDatasetTags();
                            if (App.state.selectedFilenames.size > 0) {
                                await this.loadTagsForImage(App.state.lastClickedFilename);
                            }
                        }
                    }
                },
                { separator: true },
                {
                    label: `筛选带 "${tagName}" 的图片`,
                    action: async () => {
                        await this.filterImagesByTag(tagName);
                    }
                },
                { separator: true },
                {
                    label: '从所有图片中删除...',
                    action: async () => {
                        if (confirm(`警告：此操作将从数据库和所有.txt文件中永久删除 "${tagName}" 标签！\n确定要继续吗？`)) {
                            await this.deleteTagGlobally(tagName);
                        }
                    }
                }
            ];
            ContextMenu.show(e, menuItems);
        },
        async filterImagesByTag(tagName) {
            try {
                const result = await api.getImagesByTag(tagName);
                App.state.images = result.data;
                App.state.isFilteredView = true;
                App.ui.renderImages();

                const status = document.getElementById('dataset-status');
                status.textContent = `筛选: '${tagName}' (${result.data.length} 项) - 点击清除`;
                status.classList.add('filtered');
                status.onclick = () => {
                    this.loadImages(1);
                    status.onclick = null;
                };
            } catch (err) { alert('筛选失败: ' + (err.error || '未知错误')); }
        },
        async deleteTagGlobally(tagName) {
            try {
                const result = await api.deleteTagGlobally(tagName);
                alert(result.message);
                if (App.state.selectedFilenames.size === 1) {
                    await this.loadTagsForImage(App.state.selectedFilenames.values().next().value);
                } else if (App.state.selectedFilenames.size > 1) {
                    this.loadTagsForImage(null);
                }
                await App.ui.renderDatasetTags();
            } catch (err) { alert('删除失败: ' + (err.error || '未知错误')); }
        }
    },

};

const path = {
    parse: function (pathString) {
        const extMatch = pathString.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '';
        const name = pathString.substring(0, pathString.length - ext.length);
        return { name, ext, base: pathString };
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());