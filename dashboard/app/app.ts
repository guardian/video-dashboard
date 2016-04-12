import Rx from 'rx';
import "rx-dom";
import Ractive from 'ractive';
import moment from 'moment';

import {apiRoot} from './config';
import {buildQS, formatDate, getMonth} from './utils';

const app = new Ractive({
  el: '#app',
  template: '#app-template',
  data: {
    date: getMonth(moment()),
    bars: []
  }
});

const bars$ = new Rx.Subject();
const bars = {
  setDate: startDate => {
    const daysInMonth = moment(startDate).daysInMonth();
    const dates = Array.from(Array(daysInMonth).keys()).map(i => formatDate(moment(startDate).startOf('month').add(i, 'days')));
    const ratios = dates.filter(date => moment(date).isBefore(moment())).map(date => {
      return getRatio(date);
    });
    const bsSubscription = Rx.Observable.combineLatest(...ratios).subscribe(bs => {
      bars$.onNext(bs);
      bsSubscription.dispose();
    });
  },

  bars$
};

app.observe('date', date => bars.setDate(date));
bars.bars$.subscribe(bars => app.set('bars', bars));

function getRatio(date) {
  const total$ = getTotal(date, {
    'from-date': date,
    'to-date': date
  });
  const totalWithVideos$ = getTotal(date, {
    'from-date': date,
    'to-date': date,
    'contains-element': 'videos'
  });

  return Rx.Observable.combineLatest(total$, totalWithVideos$, (total, totalWithVideos) => {
    const percent = Math.round((totalWithVideos/total)*100)
    return {date, total, totalWithVideos, percent,
      day: moment(date).format('dd'),
      dateOfMonth: moment(date).format('D'),
    };
  });
}

function getTotal(date, params) {
  return Rx.DOM.ajax({ url: `${apiRoot}?${buildQS(params)}`, responseType: 'json' })
    .map(data => data.response.response.total);
}
