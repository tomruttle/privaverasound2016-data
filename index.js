const xray = require('x-ray');
const jsonfile = require('jsonfile');
const _ = require('lodash');

const MAX_NUM_STAGES = 20;
const NUM_DAYS = 6;

const concatoniser = (obj, src) => (_.isArray(obj) ? obj.concat(src) : src);

const getTimes = (value) => (typeof value === 'string'
  ? value.match(/([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]/g)
  : value);

const x = xray({
  filters: {
    trim(value) {
      if (!value) { return null; }
      return typeof value === 'string' ? value.replace('\n', '').trim() : value;
    },
    getStartTime(value) {
      if (!value) { return null; }
      const times = getTimes(value);
      return times ? times[0] : value;
    },
    getEndTime(value) {
      if (!value) { return null; }
      const times = getTimes(value);
      return times ? times[1] : value;
    },
    log(value) {
      console.log(value);
      return value;
    },
  },
});

const getArtistsForStage = (n) => x(`#listaHorarios td:nth-child(${n}) .concertContainer`, [{
  name: '.2016_artists | trim',
  start: '.hora | getStartTime',
  end: '.hora | getEndTime',
}]);

const stageArray = Array.from({ length: MAX_NUM_STAGES }, (v, k) => k + 1);
const getStages = () => stageArray.reduce((acc, n) => Object.assign(acc, {
  [`stage ${n}`]: {
    name: `#listaHorarios thead:nth-child(2) th:nth-child(${n}) | trim`,
    artists: getArtistsForStage(n),
  },
}), { name: '#title_dias span.rojo' });

const transformDay = (day) =>
  Object.keys(day)
    .map((key) => {
      const value = day[key];
      if (!value || typeof value === 'string') { return null; }
      return value;
    })
    .reduce((artists, stage) => {
      if (!stage || !stage.name) { return artists; }

      const stageArtists = stage.artists.reduce((acc, artist) => {
        const performance = [
          {
            day: day.name,
            stage: stage.name,
            start: artist.start,
            end: artist.end,
          },
        ];

        return _.mergeWith(acc, { [artist.name]: performance }, concatoniser);
      }, {});

      return _.mergeWith(artists, stageArtists, concatoniser);
    }, {});

const lineup = x('http://lineup.primaverasound.es/horarios', '.page-horarios', getStages())
  .paginate('#title_dias span.rojo + span a@href')
  .limit(NUM_DAYS);

lineup((err, days) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  const transformed = days.reduce((acc, day) => {
    const artists = transformDay(day);
    return _.mergeWith(acc, artists, concatoniser);
  }, {});

  const ordered = Object.keys(transformed).sort().reduce((acc, key) =>
    Object.assign(acc, { [key]: transformed[key] })
  , {});

  jsonfile.writeFileSync('results.json', ordered, { spaces: 2 });
  process.exit(0);
});
