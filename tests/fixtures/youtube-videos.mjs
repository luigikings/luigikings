// Fixtures de `videos.list` (part: snippet,contentDetails,liveStreamingDetails,status) para T8 y T9.
// Un objeto por tipo de vídeo de RF-42. Los IDs tienen 11 caracteres, como los reales.

const base = (id, publishedAt, title, extra = {}) => ({
  id,
  snippet: { title, publishedAt, liveBroadcastContent: 'none', ...(extra.snippet || {}) },
  contentDetails: { duration: 'PT8M30S', ...(extra.contentDetails || {}) },
  status: { privacyStatus: 'public', ...(extra.status || {}) },
  ...(extra.liveStreamingDetails ? { liveStreamingDetails: extra.liveStreamingDetails } : {}),
});

export const VIDEOS = Object.freeze({
  normal: base('normal00001', '2026-10-20T15:00:00Z', 'How to air dribble in Rocket League'),
  normalOld: base('normal00002', '2026-09-01T15:00:00Z', 'Rotation basics for Champions'),
  normalOlder: base('normal00003', '2026-08-01T15:00:00Z', 'Best camera settings 2026'),
  normalOldest: base('normal00004', '2026-07-01T15:00:00Z', 'My first ranked session'),
  // Short: duración ≤ shortsMaxSeconds (180). La sonda decide.
  shortCandidate: base('short000001', '2026-10-21T12:00:00Z', 'Insane flip reset #shorts', {
    contentDetails: { duration: 'PT45S' },
  }),
  // Vídeo corto de 2 min que no es Short (la sonda devuelve 303).
  shortLongCandidate: base('short000002', '2026-10-19T12:00:00Z', 'Quick tip: fast aerials', {
    contentDetails: { duration: 'PT2M' },
  }),
  liveNow: base('livenow0001', '2026-10-22T08:00:00Z', 'LIVE ranked grind', {
    contentDetails: { duration: 'P0D' },
    snippet: { liveBroadcastContent: 'live' },
    liveStreamingDetails: { actualStartTime: '2026-10-22T08:00:00Z' },
  }),
  scheduledLive: base('upcoming001', '2026-10-22T07:00:00Z', 'Tournament stream tomorrow', {
    contentDetails: { duration: 'P0D' },
    snippet: { liveBroadcastContent: 'upcoming' },
    liveStreamingDetails: { scheduledStartTime: '2026-10-23T18:00:00Z' },
  }),
  // Grabación de un directo de 2 h: la duración coincide con la emisión.
  liveRecording: base('liverec0001', '2026-10-18T20:00:00Z', 'Ranked stream VOD', {
    contentDetails: { duration: 'PT2H0M5S' },
    liveStreamingDetails: { actualStartTime: '2026-10-18T18:00:00Z', actualEndTime: '2026-10-18T20:00:05Z' },
  }),
  // Estreno ya emitido: la emisión dura la del vídeo más la cuenta atrás (2 min).
  premiereAired: base('premiere001', '2026-10-17T18:00:00Z', 'Season 20 montage (premiere)', {
    contentDetails: { duration: 'PT10M' },
    liveStreamingDetails: { actualStartTime: '2026-10-17T18:00:00Z', actualEndTime: '2026-10-17T18:12:00Z' },
  }),
  premiereScheduled: base('premiere002', '2026-10-22T06:00:00Z', 'Upcoming premiere', {
    contentDetails: { duration: 'PT12M' },
    snippet: { liveBroadcastContent: 'upcoming' },
    liveStreamingDetails: { scheduledStartTime: '2026-10-25T18:00:00Z' },
  }),
  private: base('private0001', '2026-10-21T20:00:00Z', 'Private draft', { status: { privacyStatus: 'private' } }),
  unlisted: base('unlisted001', '2026-10-21T21:00:00Z', 'Unlisted clip', { status: { privacyStatus: 'unlisted' } }),
});
