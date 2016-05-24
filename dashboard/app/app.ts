import Rx from 'rx';
import "rx-dom";
import Ractive from 'ractive';
import moment from 'moment';
import 'moment-range';
import numeral from 'numeral';

import {formatDate} from './utils';
import {
  articles$ as articlesStat$,
  articlesWithVideo$ as articlesWithVideoStat$,
  videosProduced$ as videosProducedStat$,
  allMediaEvents$ as allMediaEventsStat$,
  totals$ as totalsStat$
} from './stats';
import {addMediaEvents} from './MediaEvent';

const google = window.google;
const componentHandler = window.componentHandler;

const createCapiTotalChart = (stat$) => {
  const data$ = new Rx.Subject();
  const total$ = new Rx.Subject();

  function update(dates) {
    const days = dates.map(stat$);
    const sub$ = Rx.Observable.combineLatest(...days).subscribe(data => {
      const total = data.reduce((prev, next) => prev + next.total, 0);
      data$.onNext(data);
      total$.onNext(total);
      sub$.dispose();
    });
  }

  return {
    data$,
    total$,
    update
  }
};


const mediaEventTotals$ = new Rx.Subject();
const mediaEvents$ = new Rx.Subject();

const totals = createCapiTotalChart(totalsStat$);
const articles = createCapiTotalChart(articlesStat$);
const articlesWithVideos = createCapiTotalChart(articlesWithVideoStat$);
const videosProduced = createCapiTotalChart(videosProducedStat$);

const stats = {
  setDate: (startDate, endDate) => {
    const daysInRange = [];
    moment.range([startDate, endDate]).by('days', m => daysInRange.push(m));

    const dates = Array.from(daysInRange.keys())
      .map(i => formatDate(moment(startDate).add(i, 'days')))
      .filter(date => moment(date).isSameOrBefore(moment(endDate)));

    totals.update(dates);
    articles.update(dates);
    articlesWithVideos.update(dates);
    videosProduced.update(dates);

    const mediaEventsDays = dates.map(allMediaEventsStat$);
    const mediaEventsSub$ = Rx.Observable.combineLatest(...mediaEventsDays).subscribe(mediaEvents => {
      // We shouldn't be sending these all over, but it gives us the flexibility in the template for now
      const articles = addMediaEvents(mediaEvents.map(mediaEvent => mediaEvent.articles));
      const fronts = addMediaEvents(mediaEvents.map(mediaEvent => mediaEvent.fronts));
      const videoPages = addMediaEvents(mediaEvents.map(mediaEvent => mediaEvent.videoPages));
      const total = addMediaEvents([articles, fronts, videoPages]);

      mediaEvents$.onNext(mediaEvents);

      mediaEventTotals$.onNext({total, articles, fronts, videoPages});
      mediaEventsSub$.dispose();
    });

  }
};

const startDate = formatDate(moment().startOf('month'));
const endDate = formatDate(moment().subtract(1, 'days'));
const app = new Ractive({
  el: '#app',
  template: '#app-template',
  data: {
    startDate,
    endDate,
    articlesWithVideoTotal: 0,
    articlesTotal: 0,
    formatNumber: number => numeral(number).format('0,0'),
    percent: (amount, of) => { return Math.round((amount / of) * 100) }
  }
});

const dateRange$ = new Rx.Subject();
dateRange$.startWith({startDate, endDate}).subscribe(({startDate, endDate}) => stats.setDate(startDate, endDate));
app.on('setDateRange', ev => {
  ev.original.preventDefault();
  const startDate = app.get('startDate');
  const endDate = app.get('endDate');
  dateRange$.onNext({startDate, endDate});
});


// Write totals
articles.total$.subscribe(total => app.set('articlesTotal', total));
articlesWithVideos.total$.subscribe(total => app.set('articlesWithVideoTotal', total));
videosProduced.total$.subscribe(total => app.set('videosProducedTotal', total));
mediaEventTotals$.subscribe(mediaEventTotals => app.set('mediaEventTotals', mediaEventTotals));


Rx.Observable.zip(
  articlesWithVideos.data$,
  articles.data$,
  videosProduced.data$,
  (articlesWithVideos, articles, videosProduced) =>
  ({articlesWithVideos, articles, videosProduced}))
  .subscribe(({articlesWithVideos, articles, videosProduced}) => {
  // TODO: zip
  const chartData = articles.map((article, i) => [
    article.date, articles[i].total, articlesWithVideos[i].total, videosProduced[i].total
  ]);

  const data = google.visualization.arrayToDataTable([
    ['Day', 'Articles created, total', 'With video embedded', 'videos produced']
  ].concat(chartData));

  const options = {
    hAxis: {title: 'Day', showTextEvery: 1, textStyle: {fontSize: 8}},
    vAxis: {minValue: 0},
    legend: {position: 'bottom'},
    chartArea: {'width': '100%'},
    colors: ['#333', '#fb0', '#4bc6df']
  };

  const chart = new google.visualization.AreaChart(document.getElementById('video-embeds'));
  chart.draw(data, options);
});

// Play graph
mediaEvents$.subscribe(mediaEvents => {
  const chartData = mediaEvents.map(mediaEvent => [
    mediaEvent.date, mediaEvent.articles.plays, mediaEvent.videoPages.plays, mediaEvent.fronts.plays
  ]);
  const data = google.visualization.arrayToDataTable([
    ['Day', 'Starts in article', 'Starts in video pages', 'Starts on fronts']
  ].concat(chartData));

  const options = {
    hAxis: {title: 'Day', showTextEvery: 1, textStyle: {fontSize: 8}},
    vAxis: {minValue: 0},
    legend: {position: 'bottom'},
    chartArea: {'width': '100%'},
    colors: ['#333', '#fb0', '#4bc6df']
  };

  const chart = new google.visualization.AreaChart(document.getElementById('video-plays'));
  chart.draw(data, options);
});

// Request vs play on articles
mediaEvents$.subscribe(mediaEvents => {
  const chartData = mediaEvents.map(mediaEvent => [
    mediaEvent.date, mediaEvent.articles.ready, mediaEvent.articles.plays
  ]);
  const data = google.visualization.arrayToDataTable([
    ['Day', 'Videos requested in articles', 'Videos started in articles']
  ].concat(chartData));

  const options = {
    hAxis: {title: 'Day', showTextEvery: 1, textStyle: {fontSize: 8}},
    vAxis: {minValue: 0},
    legend: {position: 'bottom'},
    chartArea: {'width': '100%'},
    colors: ['#333', '#fb0', '#4bc6df']
  };

  const chart = new google.visualization.AreaChart(document.getElementById('article-plays-vs-ready'));
  chart.draw(data, options);
});

// Request vs play on video pages
mediaEvents$.subscribe(mediaEvents => {
  const chartData = mediaEvents.map(mediaEvent => [
    mediaEvent.date, mediaEvent.videoPages.ready, mediaEvent.videoPages.plays
  ]);
  const data = google.visualization.arrayToDataTable([
    ['Day', 'Videos pages requested', 'Videos started in video pages']
  ].concat(chartData));

  const options = {
    hAxis: {title: 'Day', showTextEvery: 1, textStyle: {fontSize: 8}},
    vAxis: {minValue: 0},
    legend: {position: 'bottom'},
    chartArea: {'width': '100%'},
    colors: ['#333', '#fb0', '#4bc6df']
  };

  const chart = new google.visualization.AreaChart(document.getElementById('video-plays-vs-ready'));
  chart.draw(data, options);
});


componentHandler.upgradeDom();
