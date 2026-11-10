// El tema se aplica antes de pintar para evitar el parpadeo claro/oscuro (lo gestiona stores/settings.ts). Está en un
// fichero aparte, y no en línea en index.html, para que la política de seguridad de contenido no tenga que permitir
// scripts en línea.
(function () {
  try {
    var saved = localStorage.getItem('tt.theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : saved === 'system' ? system : 'dark';
  } catch (e) {}
})();
