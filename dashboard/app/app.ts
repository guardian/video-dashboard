import Rx from 'rx';
import "rx-dom";
import Ractive from 'ractive';
import moment from 'moment';
import numeral from 'numeral';

import {apiRoot, dashboardApiRoot} from './config';
import {buildQS, formatDate, getMonth} from './utils';

const google = window.google;

const app = new Ractive({
  el: '#app',
  template: '#app-template',
  data: {
    date: getMonth(moment())
  }
});

const embeddedVideoRatios$ = new Rx.Subject();
const readyVsPlayRatios$ = new Rx.Subject();
const erRatios$ = embeddedVideoRatios$.withLatestFrom(readyVsPlayRatios$,
  (embeddedVideoRatios, readyVsPlayRatios) => ({embeddedVideoRatios, readyVsPlayRatios}));

const ratios = {
  setDate: startDate => {
    const daysInMonth = moment(startDate).daysInMonth();
    const dates = Array.from(Array(daysInMonth).keys())
      .map(i => formatDate(moment(startDate).startOf('month').add(i, 'days')))
      .filter(date => moment(date).isBefore(moment().subtract(1, 'days')));

    const embeddedVideoRatios = dates.map(getCapiRatio);
    const embeddedVideoSubscription = Rx.Observable.combineLatest(...embeddedVideoRatios).subscribe(bs => {
      embeddedVideoRatios$.onNext(bs);
      embeddedVideoSubscription.dispose();
    });

    const articleReadyVsPlayRatios = dates.map(getArticleReadyVsPlayRatio);
    const articleReadyVsPlaySubscription = Rx.Observable.combineLatest(...articleReadyVsPlayRatios).subscribe(bs => {
      readyVsPlayRatios$.onNext(bs);
      articleReadyVsPlaySubscription.dispose();
    });
  },

  embeddedVideoRatios$,
  readyVsPlayRatios$,
  erRatios$
};

ratios.erRatios$.subscribe(({embeddedVideoRatios, readyVsPlayRatios}) => {
  const maxEmbeds = embeddedVideoRatios.reduce((prev, next) => Math.max(prev, next.total), 0);
  const maxPlays = readyVsPlayRatios.reduce((prev, next) => Math.max(prev, next.divisor), 0);
  const embedRatios = embeddedVideoRatios.map(b => ratio(maxEmbeds, b.total, b.textLabel));
  const playRatios = readyVsPlayRatios.map(b => ratio(maxPlays, b.divisor, b.textLabel));
  const embedPlayRatios = embedRatios.map((r, i) => ({embed: r, play: playRatios[i]}));

  const data = new google.visualization.DataTable();
  data.addColumn('string', 'Day');
  data.addColumn('number', 'Embeds');
  data.addColumn('number', 'Plays');
  data.addRows(embedPlayRatios.map(r => [r.play.textLabel, r.embed.divisor, r.play.divisor]));

  const options = {
    chart: {
      title: 'If we increase embeded videos in articles, do we get more plays?'
    },
    axes: {
      y: {
        0: {range: {min: 0, max: maxEmbeds}},
        1: {range: {min: 0, max: maxPlays}}
      }
    },
    series: {
      0: {axis: '0', targetAxisIndex: 0},
      1: {axis: '1', targetAxisIndex: 1}
    },
    colors: ['#fb0', '#333']
  };

  const chart = new google.charts.Line(document.getElementById('play-embed-quantities'));
  chart.draw(data, options);
});

app.observe('date', date => ratios.setDate(date));
ratios.embeddedVideoRatios$.subscribe(embeddedVideoRatios => {
  const data = new google.visualization.DataTable();
  data.addColumn('string', 'Day');
  data.addColumn('number', 'Plays');
  data.addColumn('number', 'Published');
  data.addRows(embeddedVideoRatios.map(r => [r.textLabel, r.divisor, r.total]));

  const options = {
    title: 'In what percentage of articles are we embedding video?',
    isStacked: 'percent',
    colors: ['#fb0', '#333'],
    height: 500
  };

  // Annoyingly we can't use material google.chart.Ratio as it doesn't support isStacked: 'percent'
  var chart = new google.visualization.ColumnChart(document.getElementById('embed-ratios'));
  chart.draw(data, options);
});

ratios.readyVsPlayRatios$.subscribe(readyVsPlayRatios => {
  const data = new google.visualization.DataTable();
  data.addColumn('string', 'Day');
  data.addColumn('number', 'Plays');
  data.addColumn('number', 'Published');
  data.addRows(readyVsPlayRatios.map(r => [r.textLabel, r.divisor, r.total]));

  const options = {
    title: 'How many videos are played whilst embedded in articles?',
    isStacked: 'percent',
    colors: ['#fb0', '#333'],
    height: 500
  };

  // Annoyingly we can't use material google.chart.Ratiobar as it doesn't support isStacked: 'percent'
  var chart = new google.visualization.ColumnChart(document.getElementById('video-embed-plays'));
  chart.draw(data, options);
});


function getArticleReadyVsPlayRatio(date) {
  const url = `${dashboardApiRoot}/article-video-event-counts/${date.replace(/-/g, '/')}.json`;
  return Rx.DOM.ajax({ url, responseType: 'json' }).map(resp => {
    // This is just the way we're saving this information for now
    const mediaEvents = resp.response.find(row => row.tag === 'type/article');
    return ratio(mediaEvents.ready, mediaEvents.plays, dateLabel(date))
  }).catch(() => {
    return Rx.Observable.of(ratio(0, 0, dateLabel(date)));
  });
}


function getCapiRatio(date) {
  const total$ = getCapiTotal({
    'from-date': date,
    'to-date': date,
    'type': 'article|liveblog'
  });
  const totalWithVideos$ = getCapiTotal({
    'from-date': date,
    'to-date': date,
    'type': 'article|liveblog',
    'contains-element': 'videos'
  });

  return Rx.Observable.combineLatest(total$, totalWithVideos$, (total, totalWithVideos) => {
    return ratio(total, totalWithVideos, dateLabel(date));
  });
}

function dateLabel(date) {
  return `${moment(date).format('dd')} ${moment(date).format('D')}`;
}

function ratio(total, divisor, textLabel) {
  const percent = Math.round((divisor/total)*100);
  return {total, divisor, textLabel, percent};
}

function getCapiTotal(params) {
  return Rx.DOM.ajax({ url: `${apiRoot}?${buildQS(params)}`, responseType: 'json' })
    .map(data => data.response.response.total);
}
