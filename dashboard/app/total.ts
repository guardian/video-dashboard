import Rx from 'rx';
import isolate from '@cycle/isolate';
import {apiRoot} from './config';
import {formatDate, buildQS} from './utils';

function request(dateRange$, apiParams$) {
  const apiRoot$ = Rx.Observable.just(apiRoot);
  const request$ = Rx.Observable.combineLatest(apiRoot$, dateRange$, apiParams$, (apiRoot, dateRange, apiParams) => {
    const params = buildQS(Object.assign(
      apiParams,
      {
        'from-date': formatDate(dateRange.from),
        'to-date': formatDate(dateRange.until)
      }
    ));

    const url = `${apiRoot}?${params}`;
    return {url};
  }).first();

  return request$;
}

function model(HTTPSource) {
  const total$ = HTTPSource.mergeAll().map(resp => resp.body.response.total);
  return total$;
}

// TODO: Should we return a view?


function _Total(sources, dateRange$, apiParams$) {
  const request$ = request(dateRange$, apiParams$);
  const total$ = model(sources.HTTP);

  return {
    HTTP: request$,
    total$
  };
}

export function Total(sources, dateRange$, apiParams$) {
  return isolate(_Total)(sources, dateRange$, apiParams$);
}
