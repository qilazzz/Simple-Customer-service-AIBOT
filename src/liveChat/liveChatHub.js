const { EventEmitter } = require('events');

const hub = new EventEmitter();
hub.setMaxListeners(50);

function notifyLiveChatUpdate(payload = {}) {
  hub.emit('update', payload);
}

function subscribeLiveChatUpdates(listener) {
  hub.on('update', listener);
  return () => hub.off('update', listener);
}

module.exports = {
  notifyLiveChatUpdate,
  subscribeLiveChatUpdates,
};
