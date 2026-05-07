// resource-manager.js — 资源管理（URL 方式，无 Storage 依赖）

const ResourceManager = (() => {
  const contentTypeMap = {
    image: 'image/png',
    audio: 'audio/mpeg',
    video: 'video/mp4',
    other: 'application/octet-stream'
  };

  function add({ name, url, type }) {
    return Store.addResource({
      name: name || url.split('/').pop().split('?')[0] || 'untitled',
      url: normalizeUrl(url, type),
      contentType: contentTypeMap[type] || type
    });
  }

  function remove(id) {
    return Store.deleteResource(id);
  }

  /** 将常见分享链接转为直链，便于预览 */
  function normalizeUrl(url, type) {
    if (type !== 'image') return url;

    // Google Drive: /file/d/{id}/view → uc?export=view&id={id}
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gdMatch) {
      return 'https://drive.google.com/uc?export=view&id=' + gdMatch[1];
    }
    return url;
  }

  return { add, remove, normalizeUrl };
})();
