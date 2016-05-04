import Rx from 'rx';
import {apiRoot, dashboardApiRoot} from './config';
import {buildQS, formatDate, getMonth} from './utils';
import {MediaEvent, respToMediaEvent, addMediaEvents} from './MediaEvent';

export const articlesWithVideo$ = date => {
  return getCapiTotal$({
    'from-date': date,
    'to-date': date,
    'type': 'article|liveblog',
    'contains-element': 'videos'
  }).map(total => ({date, total}));
};

export const allMediaEvents$ = date => {
  const frontsTotal$ = getFrontsMediaEvents$(date).catch(() => new MediaEvent());
  const pageTotal$ = getPageMediaEvents$(date).catch(() => new MediaEvent());

  return Rx.Observable.combineLatest(frontsTotal$, pageTotal$, (frontsTotal, pageTotal) =>
    ({
      date,
      fronts: frontsTotal,
      videoPages: pageTotal.videoPages,
      articles: pageTotal.articlePages
    }));
};

export const totals$ = date => {
  return getTotalsMediaEvents$(date);
};

function getTotalsMediaEvents$(date) {
  const url = `${dashboardApiRoot}/totals/${date.replace(/-/g, '/')}.json`;
  return Rx.DOM.ajax({ url, responseType: 'json' }).map(resp => {
    return addMediaEvents(resp.response.map(respToMediaEvent));
  });
}

function getFrontsMediaEvents$(date) {
  const url = `${dashboardApiRoot}/front-counts/${date.replace(/-/g, '/')}.json`;
  return Rx.DOM.ajax({ url, responseType: 'json' }).map(resp => {
    return addMediaEvents(resp.response.map(respToMediaEvent));
  });
}

function getPageMediaEvents$(date) {
  const url = `${dashboardApiRoot}/article-video-event-counts/${date.replace(/-/g, '/')}.json`;
  return Rx.DOM.ajax({ url, responseType: 'json' }).map(resp => {
    const articlePages = respToMediaEvent(resp.response.find(row => row.tag === 'type/article'));
    const videoPages   = respToMediaEvent(resp.response.find(row => row.tag === 'type/video'));

    return {articlePages, videoPages};
  });
}

function getCapiTotal$(params) {
  return Rx.DOM.ajax({ url: `${apiRoot}?${buildQS(params)}`, responseType: 'json' })
    .map(data => data.response.response.total);
}
