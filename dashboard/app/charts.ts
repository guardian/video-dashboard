const google = window.google;

export function DoubleLineChartOpts(title: string, max1: number, max2: number) {
  return {
    chart: {title, legend: {position: 'bottom'}},
    height: 300,
    axes: {
      y: {
        0: {range: {min: 0, max: max1}},
        1: {range: {min: 0, max: max2}}
      }
    },
    series: {
      0: {axis: 0, targetAxisIndex: 0},
      1: {axis: 1, targetAxisIndex: 1}
    },
    colors: ['#fb0', '#333']
  };
}



interface RatioGraphOpts {
  title: string;
  height: number;
  colors: string[];
  isStacked: boolean;
}

export function RatioGraphOpts(title: string): RatioGraphOpts {
 return {
   title,
   height: 400,
   colors: ['#fb0', '#333'],
   legend: 'bottom',
   isStacked: false
 };
}

interface ChartColumn {
  type: string;
  name: string;
}
export function ChartColumn(type: string, name: string): ChartColumn { return {type, name}; }

export function ChartData(columns: ChartColumn[], data: any[]): DataTable {
  const chartData = new google.visualization.DataTable();
  columns.forEach(column => chartData.addColumn(column.type, column.name));
  chartData.addRows(data);

  return chartData;
}

export function drawRatioChart(element: HTMLScriptElement, options: RatioGraphOpts, data: DataTable): ColumnChart {
  const chart = new google.visualization.Bar(element);
  chart.draw(data, options);

  return chart;
}