// resource-manager.js — 资源管理（上传/删除/预览）

const ResourceManager = (() => {
  const C = APP_CONFIG;
  const storage = firebase.storage();

  /** 上传文件到 Storage 并写入 Firestore */
  async function upload(file, onProgress) {
    const ext = file.name.split('.').pop();
    const path = 'resources/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const uploadTask = storage.ref(path).put(file, { contentType: file.type });

    if (onProgress) {
      uploadTask.on('state_changed',
        snap => onProgress(snap.bytesTransferred / snap.totalBytes * 100)
      );
    }

    await uploadTask;
    const url = await uploadTask.snapshot.ref.getDownloadURL();

    const doc = await Store.addResource({
      name: file.name,
      url,
      path,
      contentType: file.type,
      size: file.size
    });

    return { id: doc.id, name: file.name, url, contentType: file.type, size: file.size };
  }

  /** 删除资源（Firestore + Storage） */
  async function remove(id, path) {
    await Store.deleteResource(id);
    if (path) {
      try { await storage.ref(path).delete(); } catch (_) { /* 文件可能已删除 */ }
    }
  }

  return { upload, remove };
})();
