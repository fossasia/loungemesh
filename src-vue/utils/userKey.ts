export function getOrCreateSessionUserKey(): string {
  try {
    const tabOwner = sessionStorage.getItem('loungemesh_tab_owner');
    let key = sessionStorage.getItem('loungemesh_user_key');
    const isSameTab = Boolean(window.name) && window.name === tabOwner;

    if (!key || !isSameTab) {
      const tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.name = tabId;
      key = `uk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('loungemesh_user_key', key);
      sessionStorage.setItem('loungemesh_tab_owner', tabId);
    }
    return key;
  } catch {
    return `uk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
