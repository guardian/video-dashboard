import Rx from 'rx';
import CycleDOM from '@cycle/dom';
import isolate from '@cycle/isolate';
import moment from 'moment';
import {Total} from './total';

const {div} = CycleDOM;

function model(val$) {
  const date$ = val$.map(val => {
    const from = moment(val).startOf('day');
    const until = moment(val).add(1, 'day').startOf('day');

    return {from, until};
  });

  return date$;
}

function _EmbededVideoRatio(sources, date$) {
  const state$ = model(date$);

  const withVideosProperties$ = Rx.Observable.of({
    'contains-element': 'videos'
  });
  const withVideosTotalSink = Total({HTTP: sources.HTTP}, state$, withVideosProperties$);
  const withVideosTotal$ = withVideosTotalSink.total$;

  const allContentProperties$ = Rx.Observable.of({});
  const allContentTotalSink = Total({HTTP: sources.HTTP}, state$, allContentProperties$);
  const allContentTotal$ = allContentTotalSink.total$;

  const vtree$ = Rx.Observable.combineLatest(date$, withVideosTotal$, allContentTotal$, (date, withVideosTotal, allContentTotal) => {
    return div('.total', `${date}: ${withVideosTotal} / ${allContentTotal} (${Math.round((withVideosTotal/allContentTotal)*100)}%)`);
  });

  const total$ = model(sources.HTTP);

  return {
    DOM: vtree$,
    HTTP: Rx.Observable.concat(withVideosTotalSink.HTTP, allContentTotalSink.HTTP)
  }
}

export function EmbededVideoRatio(sources, date$) {
  return isolate(_EmbededVideoRatio)(sources, date$);
}
