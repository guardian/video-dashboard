import Rx from 'rx';
import "rx-dom";
import Ractive from 'ractive';
import moment from 'moment';

import {apiRoot, dashboardApiRoot} from './config';
import {buildQS, formatDate, getMonth} from './utils';

const app = new Ractive({
  el: '#app',
  template: '#app-template',
  data: {
    date: getMonth(moment()),
    bars: []
  }
});

const embeddedVideoBars$ = new Rx.Subject();
const readyVsPlayBars$ = new Rx.Subject();
const bars = {
  setDate: startDate => {
    const daysInMonth = moment(startDate).daysInMonth();
    const dates = Array.from(Array(daysInMonth).keys())
      .map(i => formatDate(moment(startDate).startOf('month').add(i, 'days')))
      .filter(date => moment(date).isBefore(moment().subtract(1, 'days')));

    const embeddedVideoRatios = dates.map(getCapiRatio);
    const embeddedVideoSubscription = Rx.Observable.combineLatest(...embeddedVideoRatios).subscribe(bs => {
      embeddedVideoBars$.onNext(bs);
      embeddedVideoSubscription.dispose();
    });

    const articleReadyVsPlayRatios = dates.map(getArticleReadyVsPlayRatio);
    const articleReadyVsPlaySubscription = Rx.Observable.combineLatest(...articleReadyVsPlayRatios).subscribe(bs => {
      readyVsPlayBars$.onNext(bs);
      articleReadyVsPlaySubscription.dispose();
    });
  },

  embeddedVideoBars$,
  readyVsPlayBars$
};

app.observe('date', date => bars.setDate(date));
bars.embeddedVideoBars$.subscribe(embeddedVideoBars => app.set('embeddedVideoBars', embeddedVideoBars));
bars.readyVsPlayBars$.subscribe(readyVsPlayBars => app.set('readyVsPlayBars', readyVsPlayBars));


function getArticleReadyVsPlayRatio(date) {
  const url = `${dashboardApiRoot}/media-event-counts/${date.replace(/-/g, '/')}.json`;
  return Rx.DOM.ajax({ url, responseType: 'json' }).map(resp => {
    // This is just the way we're saving this information for now
    const mediaEvents = resp.response[0];
    return bar(mediaEvents.ready, mediaEvents.plays, dateLabel(date))
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
    return bar(total, totalWithVideos, dateLabel(date));
  });
}

function dateLabel(date) {
  return `${moment(date).format('dd')} ${moment(date).format('D')}`;
}

function bar(total, segment, label) {
  const percent = Math.round((segment/total)*100);
  return {total, segment, label, percent};
}

function getCapiTotal(params) {
  return Rx.DOM.ajax({ url: `${apiRoot}?${buildQS(params)}`, responseType: 'json' })
    .map(data => data.response.response.total);
}
