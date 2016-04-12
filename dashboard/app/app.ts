import Rx from 'rx';
import Cycle from '@cycle/core';
import CycleDOM from '@cycle/dom';
import CycleHTTP from '@cycle/http';
import isolate from '@cycle/isolate';
import moment from 'moment';
import {apiRoot} from './config';
import {EmbededVideoRatio} from './EmbededVideoRatio';
import {formatDate} from './utils';

// v == Utils

const {makeDOMDriver, div, span, input, label} = CycleDOM;
const {Observable} = Rx;
const {makeHTTPDriver} = CycleHTTP;

// ^ == Utils
function intent(DOMSource) {
  const date$ = DOMSource.select('.date').events('input')
    .map(ev => ev.target.value)
    .startWith(formatDate(moment()));
  return {date$};
}

function view(state$) {
  return state$.map(state => {
    return div([
      input('.date', {type: 'input', value: state})
    ])});
}

function main(sources) {
  const {date$} = intent(sources.DOM);

  const days = Array.from(Array(7).keys()).map(i => {
    return EmbededVideoRatio(sources, date$.map(d => formatDate(moment(d).subtract(i, 'days'))));
  });

  const v$ = Rx.Observable.combineLatest(view(date$), ...days.map(d => d.DOM), (...args) => {
    return div('.container', args);
  });
  const h$ = Rx.Observable.concat(...days.map(d => d.HTTP));

  return {
    DOM: v$,
    HTTP: h$
  }
}

const drivers = {
  DOM: makeDOMDriver('#app'),
  HTTP: makeHTTPDriver()
}
Cycle.run(main, drivers);
