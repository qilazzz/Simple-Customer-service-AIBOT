const { stopBotProcesses, removeStaleBrowserLocks, SESSION_DIR } = require('./session-utils');

console.log('Stopping bot...');
stopBotProcesses();
removeStaleBrowserLocks();

console.log('\nBot stopped. Stale browser locks cleared.');
console.log('Run npm start to launch again.\n');
