import Rx from 'rx';
import "rx-dom";
import Ractive from 'ractive';
import moment from 'moment';
import numeral from 'numeral';

import {formatDate} from './utils';
import {articlesWithVideo$, allMediaEvents$, totals$} from './stats';
import {addMediaEvents} from './MediaEvent';

const google = window.google;
const componentHandler = window.componentHandler;

const articlesWithVideosTotal$ = new Rx.Subject();
const mediaEvents$ = new Rx.Subject();
const me$ = new Rx.Subject();
const stats = {
  setDate: (startDate, endDate) => {
    const daysInMonth = moment(startDate).daysInMonth();
    const dates = Array.from(Array(daysInMonth).keys())
      .map(i => formatDate(moment(startDate).startOf('month').add(i, 'days')))
      .filter(date => moment(date).isSameOrBefore(moment(endDate)));

    const articlesWithVideoDays = dates.map(articlesWithVideo$);
    const articlesWithVideoSub$ = Rx.Observable.combineLatest(...articlesWithVideoDays).subscribe(articles => {
      const total = articles.reduce((prev, next) => prev + next);
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

      me$.onNext(mediaEvents);

      mediaEvents$.onNext({total, articles, fronts, videoPages});
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
    formatNumber: number => numeral(number).format('0,0')
  }
});

const startDate$ = new Rx.Subject();
const endDate$ = new Rx.Subject();
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
mediaEvents$.subscribe(mediaEvents => app.set('mediaEvents', mediaEvents));

// Draw graphs
me$.subscribe(mediaEvents => {
  const chartData = mediaEvents.map(mediaEvent => [
    mediaEvent.date, mediaEvent.articles.plays, mediaEvent.videoPages.plays, mediaEvent.fronts.plays
  ]);
  const data = google.visualization.arrayToDataTable([
    ['Day', 'Articles', 'Video pages', 'Fronts']
  ].concat(chartData));

  const options = {
    title: 'Plays across different properties',
    hAxis: {title: 'Day', showTextEvery: 1, textStyle: {fontSize: 8}},
    vAxis: {minValue: 0},
    legend: {position: 'bottom'},
    chartArea: {'width': '100%'},
  };

  const chart = new google.visualization.AreaChart(document.getElementById('video-plays'));
  chart.draw(data, options);
});

componentHandler.upgradeDom();
