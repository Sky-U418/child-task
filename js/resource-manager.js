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
      url,
      contentType: contentTypeMap[type] || type
    });
  }

  function remove(id) {
    return Store.deleteResource(id);
  }

  return { add, remove };
})();
