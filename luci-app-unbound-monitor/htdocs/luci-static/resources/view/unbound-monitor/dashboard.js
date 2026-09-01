"use strict";

"require view";
"require rpc";
"require poll";

const callStats = rpc.declare({
  object: "unbound-monitor",
  method: "stats"
});

let previousStats = null;

let history = [];

let currentHistogram = [];

let histogramBars = [];

const MAX_HISTORY = 60;

const POLL_INTERVAL = 2;

/*
 * 数字转换
 */

function number(value) {
  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
}

/*
 * 数字格式化
 */

function formatNumber(value) {
  return number(value).toLocaleString();
}

/*
 * 百分比
 */

function percent(value, total) {
  if (!total) return 0;

  return (value / total) * 100;
}

/*
 * 格式化百分比
 */

function formatPercent(value) {
  value = number(value);

  if (value === 0) return "0%";

  if (value < 0.01) return value.toFixed(4) + "%";

  return value.toFixed(2) + "%";
}

/*
 * 时间单位自动转换
 */

function formatDuration(seconds) {
  seconds = number(seconds);

  if (seconds === 0) return "0ns";

  if (seconds < 0.000001) {
    const ns = seconds * 1000000000;

    return (ns < 10 ? ns.toFixed(1) : ns.toFixed(0)) + "ns";
  }

  if (seconds < 0.001) {
    const us = seconds * 1000000;

    return (us < 10 ? us.toFixed(1) : us.toFixed(0)) + "µs";
  }

  if (seconds < 1) {
    const ms = seconds * 1000;

    return (ms < 10 ? ms.toFixed(1) : ms.toFixed(0)) + "ms";
  }

  return (seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)) + "s";
}

/*
 * Histogram 标签
 */

function formatHistogramLabel(start, end) {
  start = number(start);
  end = number(end);

  if (start === 0) return "<" + formatDuration(end);

  return formatDuration(start) + "–" + formatDuration(end);
}

/*
 * 创建指标卡片
 */

function createCard(title, id) {
  return E(
    "div",
    {
      class: "unbound-monitor-card",
    },
    [
      E(
        "div",
        {
          class: "unbound-monitor-card-title",
        },
        title,
      ),

      E(
        "div",
        {
          class: "unbound-monitor-card-value",
          id: id,
        },
        "-",
      ),
    ],
  );
}

/*
 * 更新 HTML
 */

function updateText(id, value) {
  const element = document.getElementById(id);

  if (element) element.textContent = value;
}

/*
 * 解析 Histogram
 */

function parseHistogram(stats) {
  const result = [];

  Object.keys(stats).forEach(function (key) {
    if (key.indexOf("histogram.") !== 0) return;

    const text = key.substring("histogram.".length);

    const parts = text.split(".to.");

    if (parts.length !== 2) return;

    result.push({
      start: number(parts[0]),

      end: number(parts[1]),

      count: number(stats[key]),
    });
  });

  result.sort(function (a, b) {
    return a.start - b.start;
  });

  return result;
}

/*
 * Canvas DPI
 */

function prepareCanvas(canvas, height, minWidth) {

	const rect =
		canvas.getBoundingClientRect();

	const dpr =
		window.devicePixelRatio || 1;

	const container =
		canvas.parentElement;

	const containerWidth =
		container
			? container.clientWidth
			: rect.width;

	const width =
		Math.max(
			containerWidth,
			minWidth || 300
		);

	canvas.style.width =
		width + 'px';

	canvas.style.height =
		height + 'px';

	canvas.width =
		Math.floor(width * dpr);

	canvas.height =
		Math.floor(height * dpr);

	const ctx =
		canvas.getContext('2d');

	ctx.setTransform(
		dpr,
		0,
		0,
		dpr,
		0,
		0
	);

	ctx.clearRect(
		0,
		0,
		width,
		height
	);

	return {
		ctx: ctx,
		width: width,
		height: height,
		dpr: dpr
	};

}

/*
 * QPS Trend
 */

function drawQpsChart() {
  const canvas = document.getElementById("unbound-qps-chart");

  if (!canvas) return;

  const chart = prepareCanvas(canvas, 300, Math.max(canvas.getBoundingClientRect().width, 300));

  const ctx = chart.ctx;

  const width = chart.width;

  const height = chart.height;

  const padding = {
    top: 25,
    right: 25,
    bottom: 35,
    left: 60,
  };

  const chartWidth = width - padding.left - padding.right;

  const chartHeight = height - padding.top - padding.bottom;

  /*
   * 网格
   */

  ctx.strokeStyle = "#d9d9d9";

  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight * i) / 5;

    ctx.beginPath();

    ctx.moveTo(padding.left, y);

    ctx.lineTo(width - padding.right, y);

    ctx.stroke();
  }

  if (history.length < 2) return;

  const max = Math.max(...history.map((item) => item.qps), 1);

  /*
   * QPS Y Axis
   */

  ctx.fillStyle = "#666";

  ctx.font = "11px sans-serif";

  ctx.textAlign = "right";

  for (let i = 0; i <= 5; i++) {
    const value = (max * (5 - i)) / 5;

    const y = padding.top + (chartHeight * i) / 5;

    ctx.fillText(value.toFixed(0), padding.left - 8, y + 4);
  }

  /*
   * QPS Line
   */

  ctx.beginPath();

  history.forEach(function (item, index) {
    const x = padding.left + (index / (history.length - 1)) * chartWidth;

    const y = padding.top + chartHeight - (item.qps / max) * chartHeight;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#2563eb";

  ctx.lineWidth = 2;

  ctx.stroke();
}

/*
 * Histogram
 */

function drawHistogram(histogram) {
  const canvas = document.getElementById("unbound-histogram-chart");

  if (!canvas) return;

  const minWidth =
  	Math.max(
  		900,
  		histogram.length * 20
  	);
  
  const chart =
  	prepareCanvas(
  		canvas,
  		560,
  		minWidth
  	);

  const ctx = chart.ctx;

  const width = chart.width;

  const height = chart.height;

  currentHistogram = histogram;

  histogramBars = [];

  if (!histogram.length) return;

  const padding = {
    top: 30,
    right: 30,
    bottom: 180,
    left: 75,
  };

  const chartWidth = width - padding.left - padding.right;

  const chartHeight = height - padding.top - padding.bottom;

  const baseline = padding.top + chartHeight;

  const maxCount = Math.max(...histogram.map((item) => item.count), 1);

  const maxLog = Math.ceil(Math.log10(maxCount));

  /*
   * Log ticks
   */

  for (let exponent = 0; exponent <= maxLog; exponent++) {
    const value = Math.pow(10, exponent);

    const ratio = exponent / (maxLog || 1);

    const y = baseline - ratio * chartHeight;

    ctx.strokeStyle = "#e5e7eb";

    ctx.beginPath();

    ctx.moveTo(padding.left, y);

    ctx.lineTo(width - padding.right, y);

    ctx.stroke();

    ctx.fillStyle = "#666";

    ctx.font = "11px sans-serif";

    ctx.textAlign = "right";

    let label;

    if (value >= 1000) label = value / 1000 + "K";
    else label = String(value);

    ctx.fillText(label, padding.left - 8, y + 4);
  }

  /*
   * X Axis
   */

  ctx.strokeStyle = "#999";

  ctx.beginPath();

  ctx.moveTo(padding.left, baseline);

  ctx.lineTo(width - padding.right, baseline);

  ctx.stroke();

  const slotWidth = chartWidth / histogram.length;

  const barWidth = Math.max(1, slotWidth * 0.72);

  const totalCount = histogram.reduce(function (total, item) {
    return total + item.count;
  }, 0);

  histogram.forEach(function (item, index) {
    const centerX = padding.left + index * slotWidth + slotWidth / 2;

    let barHeight = 0;

    if (item.count > 0) {
      const ratio = Math.log10(item.count) / (maxLog || 1);

      barHeight = Math.max(1, ratio * chartHeight);
    }

    const x = centerX - barWidth / 2;

    const y = baseline - barHeight;

    if (item.count > 0) {
      ctx.fillStyle = "#2563eb";

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    histogramBars.push({
      left: centerX - slotWidth / 2,

      right: centerX + slotWidth / 2,

      item: item,

      total: totalCount,
    });

    /*
     * X Axis vertical label
     */

    const label = formatHistogramLabel(item.start, item.end);

    ctx.save();

    ctx.translate(centerX, baseline + 12);

    ctx.rotate(Math.PI / 2);

    ctx.fillStyle = "#666";

    ctx.font = "11px sans-serif";

    ctx.textAlign = "left";

    ctx.textBaseline = "middle";

    ctx.fillText(label, 0, 0);

    ctx.restore();
  });

  /*
   * Y Axis title
   */

  ctx.save();

  ctx.translate(18, padding.top + chartHeight / 2);

  ctx.rotate(-Math.PI / 2);

  ctx.fillStyle = "#666";

  ctx.font = "12px sans-serif";

  ctx.textAlign = "center";

  ctx.fillText("Queries (log scale)", 0, 0);

  ctx.restore();
}

/*
 * Histogram Tooltip
 */

function setupHistogramTooltip() {

	const canvas =
		document.getElementById(
			'unbound-histogram-chart'
		);

	const tooltip =
		document.getElementById(
			'unbound-histogram-tooltip'
		);

	if (!canvas || !tooltip)
		return;


	/*
	 * 获取鼠标 / 触摸位置
	 */

	function getCanvasPosition(event) {

		const rect =
			canvas.getBoundingClientRect();

		let clientX;
		let clientY;


		if (
			event.touches &&
			event.touches.length
		) {

			clientX =
				event.touches[0].clientX;

			clientY =
				event.touches[0].clientY;

		}
		else if (
			event.changedTouches &&
			event.changedTouches.length
		) {

			clientX =
				event.changedTouches[0].clientX;

			clientY =
				event.changedTouches[0].clientY;

		}
		else {

			clientX =
				event.clientX;

			clientY =
				event.clientY;

		}


		/*
		 * CSS 像素转换为 Canvas 逻辑坐标
		 */

		const scaleX =
			canvas.width
			/ rect.width;


		const scaleY =
			canvas.height
			/ rect.height;


		return {

			x:
				(clientX - rect.left)
				* scaleX
				/ (
					window.devicePixelRatio || 1
				),

			y:
				(clientY - rect.top)
				* scaleY
				/ (
					window.devicePixelRatio || 1
				),

			clientX:
				clientX,

			clientY:
				clientY,

			rect:
				rect

		};

	}


	function showTooltip(event) {

		if (!histogramBars.length)
			return;


		const position =
			getCanvasPosition(event);


		let target = null;


		histogramBars.forEach(
			function(bar) {

				if (
					position.x >= bar.left &&
					position.x <= bar.right
				) {

					target = bar;

				}

			}
		);


		if (!target) {

			tooltip.style.display =
				'none';

			return;

		}


		const item =
			target.item;


		const percentage =
			percent(
				item.count,
				target.total
			);


		tooltip.innerHTML =
			'<strong>'
			+ formatHistogramLabel(
				item.start,
				item.end
			)
			+ '</strong>'
			+ '<br>'
			+ 'Count: '
			+ formatNumber(
				item.count
			)
			+ '<br>'
			+ 'Percentage: '
			+ formatPercent(
				percentage
			);


		/*
		 * Tooltip 使用相对于
		 * histogram-container 的坐标
		 */

		const container =
			canvas.parentElement;


		const containerRect =
			container.getBoundingClientRect();


		let left =
			position.clientX
			- containerRect.left
			+ 15;


		let top =
			position.clientY
			- containerRect.top
			+ 15;


		const tooltipWidth =
			190;


		/*
		 * 防止 Tooltip 超出右侧
		 */

		if (
			left + tooltipWidth
			> containerRect.width
		) {

			left =
				position.clientX
				- containerRect.left
				- tooltipWidth
				- 15;

		}


		if (left < 5)
			left = 5;


		if (top < 5)
			top = 5;


		tooltip.style.left =
			left + 'px';


		tooltip.style.top =
			top + 'px';


		tooltip.style.display =
			'block';

	}


	function hideTooltip() {

		tooltip.style.display =
			'none';

	}


	/*
	 * Desktop
	 */

	canvas.addEventListener(
		'mousemove',
		showTooltip
	);


	canvas.addEventListener(
		'mouseleave',
		hideTooltip
	);


	/*
	 * Mobile
	 *
	 * passive: false 是为了
	 * 必要时允许阻止默认行为
	 */

	canvas.addEventListener(
		'touchstart',
		function(event) {

			showTooltip(event);

		},
		{
			passive: true
		}
	);


	canvas.addEventListener(
		'touchmove',
		function(event) {

			showTooltip(event);

		},
		{
			passive: true
		}
	);


	canvas.addEventListener(
		'touchend',
		function() {

			/*
			 * 延迟隐藏，
			 * 方便手机查看数据
			 */

			window.setTimeout(
				hideTooltip,
				1500
			);

		},
		{
			passive: true
		}
	);

}

/*
 * 更新数据
 */

function updateDashboard(stats) {
  const now = Date.now();

  /*
   * QPS
   */

  let qps = 0;

  if (previousStats) {
    const queries = number(stats["total.num.queries"]);

    const previousQueries = number(previousStats.queries);

    const elapsed = (now - previousStats.time) / 1000;

    if (elapsed > 0 && queries >= previousQueries) {
      qps = (queries - previousQueries) / elapsed;
    }
  }

  previousStats = {
    time: now,

    queries: number(stats["total.num.queries"]),
  };

  /*
   * Cache
   */

  const cacheHits = number(stats["total.num.cachehits"]);

  const cacheMiss = number(stats["total.num.cachemiss"]);

  const cacheTotal = cacheHits + cacheMiss;

  /*
   * Top cards
   */

  updateText("unbound-qps", qps.toFixed(1));

  updateText("unbound-queries", formatNumber(stats["total.num.queries"]));

  updateText(
    "unbound-cache-hit",
    formatPercent(percent(cacheHits, cacheTotal)),
  );

  updateText(
    "unbound-recursion",
    formatDuration(stats["total.recursion.time.avg"]),
  );

  updateText("unbound-bogus", formatNumber(stats["num.answer.bogus"]));

  /*
   * QPS history
   */

  history.push({
    time: now,

    qps: qps,
  });

  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  drawQpsChart();

  /*
   * Histogram
   */

  drawHistogram(parseHistogram(stats));

  /*
   * Request List
   */

  updateText(
    "requestlist-avg",
    number(stats["total.requestlist.avg"]).toFixed(2),
  );

  updateText("requestlist-max", formatNumber(stats["total.requestlist.max"]));

  updateText(
    "requestlist-current",
    formatNumber(stats["total.requestlist.current.all"]),
  );

  updateText(
    "requestlist-user",
    formatNumber(stats["total.requestlist.current.user"]),
  );

  updateText(
    "requestlist-replies",
    formatNumber(stats["total.requestlist.current.replies"]),
  );

  /*
   * Cache count
   */

  updateText("cache-msg", formatNumber(stats["msg.cache.count"]));

  updateText("cache-rrset", formatNumber(stats["rrset.cache.count"]));

  updateText("cache-infra", formatNumber(stats["infra.cache.count"]));

  updateText("cache-key", formatNumber(stats["key.cache.count"]));

  /*
   * Cachedb
   */

  updateText("cachedb", formatNumber(stats["num.query.cachedb"]));

  /*
   * Raw Stats
   */

  const raw = Object.keys(stats)
    .sort()
    .map((key) => key + "=" + stats[key])
    .join("\n");

  const rawElement = document.getElementById("unbound-raw-stats");

  if (rawElement) rawElement.textContent = raw;
}

/*
 * Tab
 */

function createTabButton(title, target, active) {
  return E(
    "button",
    {
      class: active ? "cbi-button cbi-button-action" : "cbi-button",

      "data-target": target,
    },
    title,
  );
}

/*
 * View
 */

return view.extend({
  load: function () {
    return callStats();
  },

  render: function (data) {

    const css =
	E('link', {
		'rel': 'stylesheet',
		'href': L.resource(
			'view/unbound-monitor/dashboard.css'
		)
	});

    document.head.appendChild(css);

    const page = E("div", {
      class: "cbi-map unbound-monitor",
    });

    page.appendChild(E("h2", {}, [_("Unbound Performance Monitor")]));

    /*
     * Cards
     */

    page.appendChild(
      E(
        "div",
        {
          class: "unbound-monitor-grid",
        },
        [
          createCard(_("QPS"), "unbound-qps"),

          createCard(_("Total Queries"), "unbound-queries"),

          createCard(_("Cache Hit Rate"), "unbound-cache-hit"),

          createCard(_("Avg Recursion Time"), "unbound-recursion"),

          createCard(_("Bogus Answers"), "unbound-bogus"),
        ],
      ),
    );

    /*
     * Tabs
     */

    const tabs = E("div", {
      class: "unbound-monitor-tabs",
    });

    const overview = createTabButton(_("Overview"), "overview", true);

    const requestlist = createTabButton(
      _("Request List"),
      "requestlist",
      false,
    );

    const cache = createTabButton(_("Cache"), "cache", false);

    const cachedb = createTabButton(_("Cachedb"), "cachedb", false);

    const raw = createTabButton(_("Raw Stats"), "raw", false);

    [overview, requestlist, cache, cachedb, raw].forEach((button) =>
      tabs.appendChild(button),
    );

    page.appendChild(tabs);

    /*
     * Overview
     */

    const overviewPanel = E(
      "div",
      {
        id: "unbound-tab-overview",

        class: "unbound-tab-panel",
      },
      [
        E(
          "div",
          {
            class: "cbi-section",
          },
          [
            E("h3", {}, [_("QPS Trend")]),

            E("canvas", {
              id: "unbound-qps-chart",

              class: "unbound-chart",
            }),
          ],
        ),

        E(
          "div",
          {
            class: "cbi-section",
            style: "margin-top: 10px",
          },
          [
            E("h3", {}, [_("Response Time Histogram")]),

            E('div', {
            	'class': 'unbound-histogram-wrapper'
            }, [
            
            	E('div', {
            		'class': 'unbound-histogram-scroll'
            	}, [
            
            		E('div', {
            			'class': 'unbound-histogram-container'
            		}, [
            
            			E('canvas', {
            				'id': 'unbound-histogram-chart',
            				'class': 'unbound-chart'
            			}),
            
            			E('div', {
            				'id': 'unbound-histogram-tooltip',
            				'class': 'unbound-tooltip'
            			})
            
            		])
            
            	])
            
            ])
          ],
        ),
      ],
    );

    /*
     * Request List
     */

    const requestPanel = E(
      "div",
      {
        id: "unbound-tab-requestlist",

        class: "unbound-tab-panel",

        style: "display:none",
      },
      [
        E(
          "div",
          {
            class: "unbound-stat-list",
          },
          [
            statRow(_("Average"), "requestlist-avg"),

            statRow(_("Maximum"), "requestlist-max"),

            statRow(_("Current All"), "requestlist-current"),

            statRow(_("Current User"), "requestlist-user"),

            statRow(_("Current Replies"), "requestlist-replies"),
          ],
        ),
      ],
    );

    /*
     * Cache
     */

    const cachePanel = E(
      "div",
      {
        id: "unbound-tab-cache",

        class: "unbound-tab-panel",

        style: "display:none",
      },
      [
        E(
          "div",
          {
            class: "unbound-stat-list",
          },
          [
            statRow(_("Message Cache"), "cache-msg"),

            statRow(_("RRSet Cache"), "cache-rrset"),

            statRow(_("Infra Cache"), "cache-infra"),

            statRow(_("Key Cache"), "cache-key"),
          ],
        ),
      ],
    );

    /*
     * Cachedb
     */

    const cachedbPanel = E(
      "div",
      {
        id: "unbound-tab-cachedb",

        class: "unbound-tab-panel",

        style: "display:none",
      },
      [
        E(
          "div",
          {
            class: "unbound-stat-list",
          },
          [statRow(_("Cachedb Queries"), "cachedb")],
        ),
      ],
    );

    /*
     * Raw
     */

    const rawPanel = E(
      "div",
      {
        id: "unbound-tab-raw",

        class: "unbound-tab-panel",

        style: "display:none",
      },
      [
        E("pre", {
          id: "unbound-raw-stats",

          class: "unbound-raw-stats",
        }),
      ],
    );

    page.appendChild(overviewPanel);

    page.appendChild(requestPanel);

    page.appendChild(cachePanel);

    page.appendChild(cachedbPanel);

    page.appendChild(rawPanel);

    /*
     * Tabs events
     */

    tabs.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", function () {
        const target = button.dataset.target;

        ["overview", "requestlist", "cache", "cachedb", "raw"].forEach(
          function (name) {
            const panel = document.getElementById("unbound-tab-" + name);

            panel.style.display = name === target ? "" : "none";
          },
        );

        tabs.querySelectorAll("button").forEach((item) => {
          item.classList.remove("cbi-button-action");
        });

        button.classList.add("cbi-button-action");

        /*
         * Canvas 在隐藏状态
         * 尺寸可能错误
         */

        if (target === "overview") {
          drawQpsChart();

          drawHistogram(currentHistogram);
        }
      });
    });

    setupHistogramTooltip();

    if (data && data.success) {
      updateDashboard(data.stats);
    }

    /*
     * 每 2 秒刷新
     */

    poll.add(
      L.bind(function () {
        return callStats()
          .then(function (result) {
            if (result && result.success) {
              updateDashboard(result.stats);
            }
          })
          .catch(function (error) {
            console.error("Failed to fetch Unbound stats", error);
          });
      }, this),
      POLL_INTERVAL,
    );

    return page;
  },
});

/*
 * Stat row
 */

function statRow(title, id) {
  return E(
    "div",
    {
      class: "unbound-stat-row",
    },
    [
      E("span", {}, title),

      E(
        "strong",
        {
          id: id,
        },
        "-",
      ),
    ],
  );
}
