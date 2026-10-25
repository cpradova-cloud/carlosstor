const liveUpdates = new EventSource('/__live');
liveUpdates.onmessage = (event) => {
  if (event.data === 'reload') window.location.reload();
};
