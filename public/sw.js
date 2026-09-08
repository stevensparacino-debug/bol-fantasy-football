/* BOL Fantasy Football — service worker (push notifications) */
const APP_SCOPE = '/bol-fantasy-football/'
const ICON = '/bol-fantasy-football/icon/app-icon-192.png'
const BADGE = '/bol-fantasy-football/icon/app-icon-32.png'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'BOL Fantasy Football', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'BOL Fantasy Football'
  const options = {
    body: data.body || '',
    icon: data.icon || ICON,
    badge: data.badge || BADGE,
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || APP_SCOPE },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || APP_SCOPE
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(APP_SCOPE) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
