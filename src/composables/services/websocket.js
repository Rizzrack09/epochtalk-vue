import alertStore from '@/composables/stores/alert'
import auth from '@/composables/stores/auth'
import { toRefs, reactive } from 'vue'
const socketcluster = require('socketcluster-client')
const debug = true

// Public channel idenitfier and general options
let options = { waitForAuth: true }
let publicChannelKey = JSON.stringify({ type: 'public' })
let userChannel
let session = reactive({ user: {}, auth: {} })
        console.log(auth)

// Initiate the connection to the websocket server
let socket = socketcluster.connect({
  hostname: 'localhost',
  port: 23958,
  autoReconnect: true
})

// Socket Error logging
socket.on('error', err => debug ? console.log('Websocket error:', err) : null)

// Channel Subscribe
socket.on('subscribe', channelName => {
  if (JSON.parse(channelName).type === 'role') {
    socket.watch(channelName, d => {
      if (debug) console.log('Received role channel message.', d)
      // Auth.authenticate()
    })
  }
  else if (JSON.parse(channelName).type === 'user') {
    socket.watch(channelName, d => {
      if (debug) console.log('Received user channel message', d)
      if (d.action === 'reauthenticate') session.auth.authenticate()
      else if (d.action === 'logout' && d.sessionId === socket.getAuthToken().sessionId) {
        console.log(session.auth)
        session.auth.logout()

        alertStore.warn('You have been logged out from another window.')
      }
      // else if (d.action === 'newMessage') { NotificationSvc.refresh() }
      // else if (d.action === 'refreshMentions') {
      //   NotificationSvc.refresh()
      //   NotificationSvc.refreshMentionsList()
      // }
    })
  }
  else if (JSON.parse(channelName).type === 'public') {
    socket.watch(channelName, d => d.action === 'announcement' ? alertStore.warn(d.message) : null)
  }
  else debug ? console.log('Not watching', channelName) : null

  if (debug) console.log('Websocket subscribed to', channelName, 'with watchers', socket.watchers(channelName))
})

// Channel Unsubscribe
socket.on('unsubscribe', channelName => {
  if (debug) console.log('Websocket unsubscribed from', channelName, socket.watchers(channelName))

  // disconnect all watchers from the channel
  socket.unwatch(channelName)
})

// Socket Authentication
socket.on('authenticate', () => {
  if (debug) console.log('Authenticated WebSocket Connection')

  // Emit LoggedIn event to socket server
  socket.emit('loggedIn')

  // subscribe to user channel
  let userChannelKey = JSON.stringify({ type: 'user', id: session.user.id })
  userChannel = socket.subscribe(userChannelKey, options)

  // subscribe to roles channels
  if (session.user.roles) {
    session.user.roles.forEach(role => {
      let channel = JSON.stringify({ type: 'role', id: role })
      socket.subscribe(channel, options)
    })
  }
})

socket.on('connect', status => status.isAuthenticated ? socket.emit('loggedIn') : null)

// Handle LogoutEvent
// $rootScope.$on('logoffEvent', () => {
//   socket.subscriptions().forEach(channel => {
//     if (channel !== publicChannelKey) socket.unsubscribe(channel)
//   })
//   socket.deauthenticate()
//   socket.emit('loggedOut')
// })

const login = user => {
  console.log('HERERERERERERERERE');
  Object.assign(session.user, user)
  console.log('Socket Login', user)
  socket.authenticate(user.token)
  // NotificationSvc.refresh()
  // NotificationSvc.refreshMentionsList()
}

const updateUser = user => Object.assign(session.user, user)
const setAuth = auth => Object.assign(session.auth, auth)

// API Functions
const watchUserChannel = handler => {
  if (userChannel) userChannel.watch(handler)
  else setTimeout(() => watchUserChannel(handler), 1000)
}

const unwatchUserChannel = handler => userChannel ? userChannel.unwatch(handler) : null

const isOnline = (user, callback) => {
  if (socket.state === 'open') socket.emit('isOnline', user, callback)
  else setTimeout(() => isOnline(user, callback), 1000)
}


// always subscribe to the public channel
const publicChannel = socket.subscribe(publicChannelKey, options)

export default {
  ...toRefs(session),
  updateUser: updateUser,
  setAuth: setAuth,
  socket: socket,
  login: login,
  publicChannel: publicChannel,
  publicChannelKey: publicChannelKey,
  watchUserChannel: watchUserChannel,
  unwatchUserChannel: unwatchUserChannel,
  isOnline: isOnline
}
