const base = process.env.TEST_RELAY_URL || 'ws://127.0.0.1:8792';
const room = crypto.randomUUID();
const token = crypto.randomUUID().replaceAll('-', '');

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${base}/room/${room}?token=${token}`);
    const messages = [];
    const timeout = setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
    socket.addEventListener('message', event => {
      try { messages.push(JSON.parse(event.data)); } catch {}
    });
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve({ socket, messages });
    });
    socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
  });
}

function latest(messages, type) {
  return messages.filter(message => message.type === type).at(-1);
}

function assert(value, message) {
  if (!value) throw new Error(message);
}

const httpBase = base.replace(/^ws/, 'http');
const health = await fetch(`${httpBase}/v1/health`).then(response => response.json());
assert(health.ok && health.service === 'ksr-gameboi-relay' && health.protocol === 2, 'Health endpoint failed');

const first = await connect();
await wait(80);
const second = await connect();
await wait(120);
assert(latest(first.messages, 'role')?.host === true, 'First viewer was not host');
assert(latest(second.messages, 'role')?.host === false, 'Second viewer was not follower');
assert(latest(first.messages, 'viewers')?.count === 2, 'Viewer count did not reach two');

const eventId = 'shared-mesh-event-1';
first.socket.send(JSON.stringify({ type: 'input', key: 'left', pressed: true, eventId }));
second.socket.send(JSON.stringify({ type: 'input', key: 'left', pressed: true, eventId }));
await wait(100);
assert(first.messages.filter(message => message.type === 'input' && message.eventId === eventId).length === 1, 'Duplicate input reached host');
assert(second.messages.filter(message => message.type === 'input' && message.eventId === eventId).length === 1, 'Duplicate input reached follower');

first.socket.send(JSON.stringify({ type: 'input', key: 'left', pressed: false, eventId: 'shared-mesh-event-2' }));
await wait(80);
assert(latest(second.messages, 'input')?.pressed === false, 'Button release was not relayed');

second.socket.send(JSON.stringify({ type: 'pointer', phase: 'down', x: 0.9, y: 0.9, pointerId: 7, eventId: 'viewer-pointer' }));
await wait(80);
assert(!second.messages.some(message => message.type === 'pointer' && message.eventId === 'viewer-pointer'), 'Viewer pointer input was accepted');

first.socket.send(JSON.stringify({ type: 'pointer', phase: 'down', x: 0.25, y: 0.75, pointerId: 7, buttons: 1, pressure: 0.5, eventId: 'host-pointer' }));
await wait(80);
const relayedPointer = latest(second.messages, 'pointer');
assert(relayedPointer?.eventId === 'host-pointer', 'Host pointer input was not relayed');
assert(relayedPointer.x === 0.25 && relayedPointer.y === 0.75, 'Pointer coordinates changed in transit');

second.socket.send(JSON.stringify({ type: 'state', state: { gameId: 'snake', snapshot: { score: 999 } } }));
first.socket.send(JSON.stringify({ type: 'state', state: { gameId: 'snake', snapshot: { score: 120 } } }));
await wait(120);
assert(latest(second.messages, 'state')?.state?.snapshot?.score === 120, 'Host state was not authoritative');

first.socket.close(1000, 'Test host complete');
await wait(180);
assert(latest(second.messages, 'role')?.host === true, 'Follower was not promoted after host left');
assert(latest(second.messages, 'viewers')?.count === 1, 'Viewer count did not return to one');

second.socket.close(1000, 'Test complete');
console.log(JSON.stringify({
  health: true,
  hostElection: true,
  duplicateSuppression: true,
  buttonRelease: true,
  hostOnlyPointer: true,
  pointerCoordinates: true,
  authoritativeState: true,
  hostFailover: true
}));
