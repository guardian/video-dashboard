import Rx from 'rx';
import "rx-dom";
import Ractive from 'ractive';
import moment from 'moment';
import numeral from 'numeral';

import {formatDate} from './utils';
import {articlesWithVideo$, allMediaEvents$, totals$, articles$} from './stats';
import {addMediaEvents} from './MediaEvent';

const google = window.google;
const componentHandler = window.componentHandler;

const articlesTotal$ = new Rx.Subject();
const articlesWithVideosTotal$ = new Rx.Subject();
const allArticles$ = new Rx.Subject();
const articlesWithVideos$ = new Rx.Subject();
const mediaEventTotals$ = new Rx.Subject();
const mediaEvents$ = new Rx.Subject();
const stats = {
  setDate: (startDate, endDate) => {
    const daysInMonth = moment(startDate).daysInMonth();
    const dates = Array.from(Array(daysInMonth).keys())
      .map(i => formatDate(moment(startDate).startOf('month').add(i, 'days')))
      .filter(date => moment(date).isSameOrBefore(moment(endDate)));

    const articlesDays = dates.map(articles$);
    const articlesSub$ = Rx.Observable.combineLatest(...articlesDays).subscribe(articles => {
      const total = articles.reduce((prev, next) => prev + next.total, 0);

      allArticles$.onNext(articles);
      articlesTotal$.onNext(total);
      articlesSub$.dispose();
    });

    const articlesWithVideoDays = dates.map(articlesWithVideo$);
    const articlesWithVideoSub$ = Rx.Observable.combineLatest(...articlesWithVideoDays).subscribe(articles => {
      const total = articles.reduce((prev, next) => prev + next.total, 0);

      articlesWithVideos$.onNext(articles);
      articlesWithVideosTotal$.onNext(total);
      articlesWithVideoSub$.dispose();
    });

    const mediaEventsDays = dates.map(allMediaEvents$);
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
articlesWithVideosTotal$.subscribe(total => app.set('articlesWithVideoTotal', total));
articlesTotal$.subscribe(total => app.set('articlesTotal', total));
mediaEventTotals$.subscribe(mediaEventTotals => app.set('mediaEventTotals', mediaEventTotals));

Rx.Observable.combineLatest(articlesWithVideos$, allArticles$, (articlesWithVideos, articles) => ({articlesWithVideos, articles})).subscribe(({articlesWithVideos, articles}) => {
  // TODO: zip
  const chartData = articlesWithVideos.map((articleWithVideos, i) => [
    articleWithVideos.date, articles[i].total, articleWithVideos.total
  ]);

  const data = google.visualization.arrayToDataTable([
    ['Day', 'Articles created, total', 'With video embedded']
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
