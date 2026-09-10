"use strict";

"require view";
"require rpc";
"require poll";

const callStats = rpc.declare({
  object: "unbound-monitor",
  method: "stats",
});

const MAX_HISTORY = 60;
const POLL_INTERVAL = 2;

let previousStats = null;
let history = [];
let currentHistogram = [];
let qpsChart = null;
let histogramChart = null;
let chartsReady = false;
let dashboardPage = null;

const MEMORY_FIELDS = [
  ["message", "mem.cache.message"],
  ["rrset", "mem.cache.rrset"],
  ["dnscrypt-secret", "mem.cache.dnscrypt_shared_secret"],
  ["dnscrypt-nonce", "mem.cache.dnscrypt_nonce"],
  ["iterator", "mem.mod.iterator"],
  ["validator", "mem.mod.validator"],
  ["streamwait", "mem.streamwait"],
  ["http-query", "mem.http.query_buffer"],
  ["http-response", "mem.http.response_buffer"],
  ["quic", "mem.quic"],
];

function number(value) {
  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
}

function formatNumber(value) {
  return number(value).toLocaleString();
}

function formatHistogramAxisValue(value) {
  const units = [
    [1000000000000, "T"],
    [1000000000, "B"],
    [1000000, "M"],
    [1000, "K"],
  ];

  value = number(value);

  for (let i = 0; i < units.length; i++) {
    if (value >= units[i][0]) {
      const scaled = value / units[i][0];
      const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;

      return Number(scaled.toFixed(decimals)) + units[i][1];
    }
  }

  return formatNumber(value);
}

function formatBytes(value) {
  let bytes = Math.max(0, number(value));
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let unit = 0;

  while (bytes >= 1024 && unit < units.length - 1) {
    bytes /= 1024;
    unit++;
  }

  if (unit === 0) return Math.round(bytes) + " " + units[unit];

  return (bytes < 10 ? bytes.toFixed(2) : bytes < 100 ? bytes.toFixed(1) : bytes.toFixed(0)) +
    " " + units[unit];
}

function formatUptime(value) {
  let seconds = Math.max(0, Math.floor(number(value)));
  const days = Math.floor(seconds / 86400);

  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);

  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const parts = [];

  if (days) parts.push(days + "d");
  if (hours || days) parts.push(String(hours).padStart(2, "0") + "h");
  if (minutes || hours || days) parts.push(String(minutes).padStart(2, "0") + "m");

  parts.push(String(remainingSeconds).padStart(2, "0") + "s");

  return parts.join(" ");
}

function percent(value, total) {
  return total ? (value / total) * 100 : 0;
}

function formatPercent(value) {
  value = number(value);

  if (value === 0) return "0%";
  if (value < 0.01) return value.toFixed(4) + "%";

  return value.toFixed(2) + "%";
}

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

  if (seconds < 60) {
    return (seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)) + "s";
  }

  const minutes = seconds / 60;

  if (seconds < 3600) {
    return (minutes < 10 ? minutes.toFixed(1) : minutes.toFixed(0)) + "min";
  }

  const hours = seconds / 3600;

  if (seconds < 86400) {
    return (hours < 10 ? hours.toFixed(1) : hours.toFixed(0)) + "h";
  }

  const days = seconds / 86400;

  return (days < 10 ? days.toFixed(1) : days.toFixed(0)) + "d";
}

function formatHistogramLabel(start, end) {
  start = number(start);
  end = number(end);

  if (start === 0) return "<" + formatDuration(end);

  return formatDuration(start) + "–" + formatDuration(end);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function updateText(id, value) {
  const element = dashboardPage
    ? dashboardPage.querySelector("#" + id)
    : document.getElementById(id);

  if (element) element.textContent = value;
}

function createIcon(name) {
  const paths = {
    activity: "M3 12h4l3-8 4 16 3-8h4",
    queries: "M4 5h16v5H4z M4 14h16v5H4z M7 7.5h.01 M7 16.5h.01",
    cache: "M20 7l-8-4-8 4 8 4z M4 12l8 4 8-4 M4 17l8 4 8-4",
    clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M12 8v5 M12 16h.01",
    runtime: "M5 5a9 9 0 1 1-2 9 M5 2v5H1 M12 7v5l3 2",
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", paths[name] || paths.activity);
  svg.appendChild(path);

  return svg;
}

function createCard(title, id, icon, description, value) {
  return E(
    "div",
    { class: "unbound-monitor-card unbound-card-" + icon },
    [
      E("div", { class: "unbound-card-heading" }, [
        E("div", { class: "unbound-monitor-card-title" }, title),
        E("span", { class: "unbound-card-icon" }, [createIcon(icon)]),
      ]),
      E(
        "div",
        { class: "unbound-monitor-card-value", id: value ? null : id },
        value || "-",
      ),
      E("div", { class: "unbound-card-description" }, description),
    ],
  );
}

function statRow(title, id) {
  return E(
    "div",
    { class: "unbound-stat-row" },
    [E("span", {}, title), E("strong", { id: id }, "-")],
  );
}

function createTabButton(title, target, active) {
  return E(
    "button",
    {
      class: "unbound-tab-button",
      "data-target": target,
      id: "unbound-nav-" + target,
      role: "tab",
      "aria-controls": "unbound-tab-" + target,
      "aria-selected": active ? "true" : "false",
      tabindex: active ? "0" : "-1",
      type: "button",
    },
    title,
  );
}

function parseHistogram(stats) {
  const result = [];

  Object.keys(stats).forEach(function (key) {
    if (key.indexOf("histogram.") !== 0) return;

    const parts = key.substring("histogram.".length).split(".to.");

    if (parts.length !== 2) return;

    result.push({
      start: number(parts[0]),
      end: number(parts[1]),
      count: number(stats[key]),
    });
  });

  /* Histogram buckets need numerical order for a meaningful x axis. */
  result.sort(function (a, b) {
    return a.start - b.start;
  });

  return result;
}

function cssColor(name, fallback) {
  const element = dashboardPage || document.body || document.documentElement;
  const value = getComputedStyle(element).getPropertyValue(name).trim();

  if (!value) return fallback;

  /* Resolve nested theme variables before passing colors to Canvas. */
  const probe = document.createElement("span");

  probe.style.color = value;
  probe.style.display = "none";
  element.appendChild(probe);

  const resolved = getComputedStyle(probe).color;

  probe.remove();

  return resolved || fallback;
}

function colorWithAlpha(color, alpha) {
  const match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (!match) {
    const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);

    return rgb
      ? "rgba(" + rgb[1] + "," + rgb[2] + "," + rgb[3] + "," + alpha + ")"
      : color;
  }

  let hex = match[1];

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map(function (part) {
        return part + part;
      })
      .join("");
  }

  return "rgba(" +
    parseInt(hex.substring(0, 2), 16) + "," +
    parseInt(hex.substring(2, 4), 16) + "," +
    parseInt(hex.substring(4, 6), 16) + "," +
    alpha + ")";
}

function chartColors() {
  const text = cssColor("--um-text", "#20334b");
  const mutedText = cssColor("--um-muted", "#64748b");
  const border = cssColor("--um-border", "#e3eaf0");
  const accent = cssColor("--um-accent", "#0d9488");
  const tooltipBackground = cssColor("--um-surface", "#fff");

  return {
    text: text,
    mutedText: mutedText,
    border: border,
    grid: colorWithAlpha(text, 0.08),
    accent: accent,
    accentFill: colorWithAlpha(accent, 0.2),
    tooltipBackground: tooltipBackground,
  };
}

function destroyChart(chart) {
  if (chart && typeof chart.destroy === "function") chart.destroy();
}

function sizeCanvas(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
}

function drawChartGrid(ctx, width, height, padding, maxValue, colors, formatValue) {
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 5; i++) {
    const ratio = i / 5;
    const y = padding.top + chartHeight * ratio;
    const value = maxValue * (1 - ratio);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = colors.mutedText;
    ctx.fillText(
      formatValue ? formatValue(value) : value.toFixed(0),
      padding.left - 8,
      y,
    );
  }

  return {
    width: chartWidth,
    height: chartHeight,
    baseline: padding.top + chartHeight,
  };
}

function drawUnboundLineChart(chart, data) {
  const ctx = chart.chart.ctx;
  const width = chart.chart.width;
  const height = chart.chart.height;
  const colors = chartColors();
  const values = (data.datasets[0] && data.datasets[0].data) || [];
  const padding = { top: 20, right: 20, bottom: 35, left: 55 };

  ctx.clearRect(0, 0, width, height);

  const maxValue = Math.max.apply(null, values.concat([1]));
  const area = drawChartGrid(ctx, width, height, padding, maxValue, colors);

  if (!values.length) return;

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();

  values.forEach(function (value, index) {
    const x = padding.left +
      (values.length === 1 ? area.width / 2 : index / (values.length - 1) * area.width);
    const y = padding.top + area.height - number(value) / maxValue * area.height;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  const firstX = padding.left + (values.length === 1 ? area.width / 2 : 0);
  const lastX = padding.left + (values.length === 1 ? area.width / 2 : area.width);
  const gradient = ctx.createLinearGradient(0, padding.top, 0, area.baseline);

  gradient.addColorStop(0, colorWithAlpha(colors.accent, 0.24));
  gradient.addColorStop(1, colorWithAlpha(colors.accent, 0.01));
  ctx.lineTo(lastX, area.baseline);
  ctx.lineTo(firstX, area.baseline);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(lastX, area.baseline - number(values[values.length - 1]) / maxValue * area.height, 4, 0, Math.PI * 2);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  ctx.fillStyle = colors.mutedText;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  [0, Math.floor((values.length - 1) / 2), values.length - 1]
    .filter(function (value, index, list) {
      return list.indexOf(value) === index;
    })
    .forEach(function (index) {
      const x = padding.left +
        (values.length === 1 ? area.width / 2 : index / (values.length - 1) * area.width);

      ctx.fillText(data.labels[index] || "", x, height - padding.bottom + 10);
    });
}

function drawUnboundBarChart(chart, data) {
  const ctx = chart.chart.ctx;
  const width = chart.chart.width;
  const height = chart.chart.height;
  const colors = chartColors();
  const values = (data.datasets[0] && data.datasets[0].data) || [];
  const labels = data.labels || [];
  const padding = { top: 20, right: 20, bottom: 150, left: 60 };

  ctx.clearRect(0, 0, width, height);

  const maxValue = Math.max.apply(null, values.concat([1]));
  const area = drawChartGrid(
    ctx,
    width,
    height,
    padding,
    maxValue,
    colors,
    formatHistogramAxisValue,
  );
  const slotWidth = values.length ? area.width / values.length : area.width;
  const barWidth = Math.max(1, slotWidth * 0.72);

  values.forEach(function (value, index) {
    const barHeight = number(value) / maxValue * area.height;
    const centerX = padding.left + index * slotWidth + slotWidth / 2;
    const x = centerX - barWidth / 2;
    const y = area.baseline - barHeight;

    if (barHeight > 0) {
      ctx.fillStyle = colors.accent;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.save();
    ctx.translate(centerX, area.baseline + 12);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = colors.mutedText;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[index] || "", 0, 0);
    ctx.restore();
  });
}

function hideChartTooltip(tooltip) {
  tooltip.style.display = "none";
}

function showChartTooltip(tooltip, event, title, value) {
  tooltip.textContent = "";
  tooltip.appendChild(E("strong", {}, title));
  tooltip.appendChild(E("div", {}, value));
  tooltip.style.display = "block";

  const gap = 14;
  const tooltipRect = tooltip.getBoundingClientRect();
  const left = Math.min(
    event.clientX + gap,
    window.innerWidth - tooltipRect.width - gap,
  );
  const top = Math.min(
    event.clientY + gap,
    window.innerHeight - tooltipRect.height - gap,
  );

  tooltip.style.left = Math.max(gap, left) + "px";
  tooltip.style.top = Math.max(gap, top) + "px";
}

function setupChartTooltips(page) {
  const tooltip = page.querySelector("#unbound-chart-tooltip");
  const qpsCanvas = page.querySelector("#unbound-qps-chart");
  const histogramCanvas = page.querySelector("#unbound-histogram-chart");

  if (!tooltip || !qpsCanvas || !histogramCanvas) return;

  function canvasX(canvas, event) {
    const rect = canvas.getBoundingClientRect();

    return (event.clientX - rect.left) * canvas.width / rect.width;
  }

  qpsCanvas.addEventListener("mousemove", function (event) {
    if (!history.length) {
      hideChartTooltip(tooltip);
      return;
    }

    const padding = { left: 55, right: 20 };
    const x = canvasX(qpsCanvas, event);
    const chartWidth = qpsCanvas.width - padding.left - padding.right;

    if (x < padding.left || x > qpsCanvas.width - padding.right) {
      hideChartTooltip(tooltip);
      return;
    }

    const ratio = (x - padding.left) / chartWidth;
    const index = Math.max(
      0,
      Math.min(history.length - 1, Math.round(ratio * (history.length - 1))),
    );
    const item = history[index];

    showChartTooltip(
      tooltip,
      event,
      formatTime(item.time),
      _("QPS") + ": " + number(item.qps).toFixed(2),
    );
  });

  qpsCanvas.addEventListener("mouseleave", function () {
    hideChartTooltip(tooltip);
  });

  histogramCanvas.addEventListener("mousemove", function (event) {
    if (!currentHistogram.length) {
      hideChartTooltip(tooltip);
      return;
    }

    const padding = { left: 60, right: 20, top: 20, bottom: 150 };
    const rect = histogramCanvas.getBoundingClientRect();
    const x = canvasX(histogramCanvas, event);
    const y = (event.clientY - rect.top) * histogramCanvas.height / rect.height;
    const chartWidth = histogramCanvas.width - padding.left - padding.right;
    const chartHeight = histogramCanvas.height - padding.top - padding.bottom;

    if (
      x < padding.left ||
      x > histogramCanvas.width - padding.right ||
      y < padding.top ||
      y > padding.top + chartHeight
    ) {
      hideChartTooltip(tooltip);
      return;
    }

    const slotWidth = chartWidth / currentHistogram.length;
    const index = Math.max(
      0,
      Math.min(currentHistogram.length - 1, Math.floor((x - padding.left) / slotWidth)),
    );
    const item = currentHistogram[index];

    showChartTooltip(
      tooltip,
      event,
      formatHistogramLabel(item.start, item.end),
      _("Count") + ": " + formatNumber(item.count),
    );
  });

  histogramCanvas.addEventListener("mouseleave", function () {
    hideChartTooltip(tooltip);
  });
}

function registerChartTypes() {
  if (!window.Chart || !Chart.Type || typeof Chart.Type.extend !== "function") return;

  if (typeof Chart.prototype.UnboundLine !== "function") {
    Chart.Type.extend({
      name: "UnboundLine",
      defaults: { animation: false, responsive: false },
      initialize: function (data) {
        this.data = data || {};
        this.render();
      },
      draw: function () {
        drawUnboundLineChart(this, this.data);
      },
    });
  }

  if (typeof Chart.prototype.UnboundBar !== "function") {
    Chart.Type.extend({
      name: "UnboundBar",
      defaults: { animation: false, responsive: false },
      initialize: function (data) {
        this.data = data || {};
        this.render();
      },
      draw: function () {
        drawUnboundBarChart(this, this.data);
      },
    });
  }
}

function drawQpsChart() {
  const canvas = document.getElementById("unbound-qps-chart");

  if (!chartsReady || !canvas || !canvas.parentElement) return;

  const colors = chartColors();
  if (!canvas.offsetWidth) return;

  const width = Math.max(canvas.parentElement.clientWidth || 600, 220);

  sizeCanvas(canvas, width, 300);
  destroyChart(qpsChart);
  qpsChart = null;

  qpsChart = new Chart(canvas.getContext("2d")).UnboundLine(
    {
      labels: history.map(function (item) {
        return formatTime(item.time);
      }),
      datasets: [
        {
          label: _("Queries per second"),
          data: history.map(function (item) {
            return item.qps;
          }),
          fillColor: colors.accentFill,
          strokeColor: colors.accent,
          pointColor: colors.accent,
          pointStrokeColor: colors.accent,
          pointHighlightFill: colors.accent,
          pointHighlightStroke: colors.text,
        },
      ],
    },
    {
      responsive: false,
      animation: false,
      bezierCurve: false,
      pointDot: false,
      scaleBeginAtZero: true,
      /* QPS 使用普通线性刻度，不使用对数轴。 */
      scaleOverride: false,
      scaleIntegersOnly: false,
      scaleFontColor: colors.mutedText,
      scaleLineColor: colors.border,
      scaleGridLineColor: colors.grid,
      scaleLabel: "<%=value%>",
      tooltipFillColor: colors.tooltipBackground,
      tooltipFontColor: colors.text,
      tooltipTitleFontColor: colors.text,
      tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %>",
    },
  );
}

function drawHistogram(histogram) {
  const canvas = document.getElementById("unbound-histogram-chart");

  currentHistogram = histogram;

  if (!chartsReady || !canvas || !canvas.parentElement) return;

  if (!canvas.offsetWidth) return;

  const colors = chartColors();
  const containerWidth = canvas.parentElement.clientWidth || 900;
  const width = Math.max(containerWidth, 900, histogram.length * 28);

  sizeCanvas(canvas, width, 420);
  destroyChart(histogramChart);
  histogramChart = null;

  if (!histogram.length) return;

  histogramChart = new Chart(canvas.getContext("2d")).UnboundBar(
    {
      labels: histogram.map(function (item) {
        return formatHistogramLabel(item.start, item.end);
      }),
      datasets: [
        {
          label: _("Queries"),
          data: histogram.map(function (item) {
            return item.count;
          }),
          fillColor: colors.accent,
          strokeColor: colors.accent,
          highlightFill: colors.accent,
          highlightStroke: colors.accent,
        },
      ],
    },
    {
      responsive: false,
      animation: false,
      scaleBeginAtZero: true,
      scaleFontColor: colors.mutedText,
      scaleLineColor: colors.border,
      scaleGridLineColor: colors.grid,
      scaleLabel: "<%=value%>",
      tooltipFillColor: colors.tooltipBackground,
      tooltipFontColor: colors.text,
      tooltipTitleFontColor: colors.text,
      tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %>",
    },
  );
}

function loadChartLibrary(page, callback) {
  if (window.Chart) {
    chartsReady = true;
    registerChartTypes();
    callback();
    return;
  }

  const script = E("script", {
    type: "text/javascript",
    src: L.resource("nlbw.chart.min.js"),
    "data-unbound-chartjs": "1",
    load: function () {
      chartsReady = !!window.Chart;

      registerChartTypes();
      callback();
    },
  });

  page.appendChild(script);
}

function updateDashboard(stats) {
  if (!stats) return;

  const now = Date.now();
  updateConnectionStatus(true);
  updateText("unbound-last-update", _("Last updated") + " " + formatTime(now));
  const queries = number(stats["total.num.queries"]);
  let qps = 0;

  if (previousStats) {
    const elapsed = (now - previousStats.time) / 1000;

    if (elapsed > 0 && queries >= previousStats.queries) {
      qps = (queries - previousStats.queries) / elapsed;
    }
  }

  previousStats = { time: now, queries: queries };

  const baseCacheHits = number(stats["total.num.cachehits"]);
  const cacheMisses = number(stats["total.num.cachemiss"]);
  const ecsCacheHits = number(stats["num.query.subnet_cache"]);
  const cacheHits = baseCacheHits + ecsCacheHits;

  updateText("unbound-qps", qps.toFixed(1));
  updateText("unbound-queries", formatNumber(queries));
  updateText("unbound-uptime", formatUptime(stats["time.up"]));
  updateText(
    "unbound-cache-hit",
    formatPercent(percent(cacheHits, baseCacheHits + cacheMisses)),
  );
  updateText("unbound-recursion", formatDuration(stats["total.recursion.time.avg"]));
  updateText("unbound-recursion-median", formatDuration(stats["total.recursion.time.median"]));
  updateText("unbound-bogus", formatNumber(stats["num.answer.bogus"]));

  history.push({ time: now, qps: qps });

  if (history.length > MAX_HISTORY) history.shift();

  updateText("unbound-qps-current", qps.toFixed(1));
  updateText("unbound-qps-peak", Math.max.apply(null, history.map(function (item) {
    return item.qps;
  })).toFixed(1));

  updateText("requestlist-avg", number(stats["total.requestlist.avg"]).toFixed(2));
  updateText("requestlist-max", formatNumber(stats["total.requestlist.max"]));
  updateText("requestlist-current", formatNumber(stats["total.requestlist.current.all"]));
  updateText("requestlist-user", formatNumber(stats["total.requestlist.current.user"]));
  updateText("requestlist-replies", formatNumber(stats["total.requestlist.current.replies"]));

  updateText("cache-msg", formatNumber(stats["msg.cache.count"]));
  updateText("cache-rrset", formatNumber(stats["rrset.cache.count"]));
  updateText("cache-infra", formatNumber(stats["infra.cache.count"]));
  updateText("cache-key", formatNumber(stats["key.cache.count"]));
  updateText("cache-hits", formatNumber(baseCacheHits));
  updateText("cache-misses", formatNumber(cacheMisses));
  updateText("cache-prefetch", formatNumber(stats["total.num.prefetch"]));
  updateText("cache-ecs", formatNumber(ecsCacheHits));
  updateText("cachedb", formatNumber(stats["num.query.cachedb"]));

  let memoryTotal = 0;

  MEMORY_FIELDS.forEach(function (field) {
    const bytes = number(stats[field[1]]);

    memoryTotal += bytes;
    updateText("memory-" + field[0], formatBytes(bytes));
  });

  updateText("memory-total", formatBytes(memoryTotal));

  updateText("bogus-answers", formatNumber(stats["num.answer.bogus"]));
  updateText("bogus-rrsets", formatNumber(stats["num.rrset.bogus"]));
  updateText("secure-answers", formatNumber(stats["num.answer.secure"]));
  updateText("validation-ops", formatNumber(stats["num.valops"]));

  /* Keep the order emitted by unbound-control; it is useful when debugging. */
  const raw = Object.keys(stats)
    .map(function (key) {
      return key + "=" + stats[key];
    })
    .join("\n");
  const rawElement = dashboardPage
    ? dashboardPage.querySelector("#unbound-raw-stats")
    : document.getElementById("unbound-raw-stats");

  if (rawElement) rawElement.textContent = raw;

  drawQpsChart();
  drawHistogram(parseHistogram(stats));
}

function updateConnectionStatus(connected) {
  if (!dashboardPage) return;

  const status = dashboardPage.querySelector("#unbound-connection");

  status.classList.toggle("unbound-status-error", !connected);
  updateText("unbound-connection-label", connected ? _("Live monitoring") : _("Update unavailable"));
}

function setupTabs(tabs) {
  const tabNames = [
    "overview",
    "requestlist",
    "cache",
    "cachedb",
    "memory",
    "bogus",
    "raw",
  ];

  tabs.querySelectorAll("button").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = button.dataset.target;

      tabNames.forEach(function (name) {
        const panel = document.getElementById("unbound-tab-" + name);

        if (panel) panel.style.display = name === target ? "" : "none";
      });

      tabs.querySelectorAll("button").forEach(function (item) {
        item.setAttribute("aria-selected", item === button ? "true" : "false");
        item.setAttribute("tabindex", item === button ? "0" : "-1");
      });

      hideChartTooltip(dashboardPage.querySelector("#unbound-chart-tooltip"));

      if (target === "overview") {
        drawQpsChart();
        drawHistogram(currentHistogram);
      }
    });
    button.addEventListener("keydown", function (event) {
      const buttons = Array.from(tabs.querySelectorAll("button"));
      let index = buttons.indexOf(button);

      if (event.key === "ArrowRight") index = (index + 1) % buttons.length;
      else if (event.key === "ArrowLeft") index = (index + buttons.length - 1) % buttons.length;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = buttons.length - 1;
      else return;

      event.preventDefault();
      buttons[index].focus();
      buttons[index].click();
    });
  });
}

return view.extend({
  load: function () {
    return callStats().catch(function () { return null; });
  },

  render: function (data) {
    const page = E(
      "div",
      { class: "cbi-map unbound-monitor" },
      [
        E("link", {
          rel: "stylesheet",
          href: L.resource("view/unbound-monitor/dashboard.css"),
        }),
        E("div", { class: "unbound-page-header" }, [
          E("div", { class: "unbound-page-title" }, [
            E("span", { class: "unbound-brand-icon" }, [createIcon("activity")]),
            E("div", {}, [
              E("div", { class: "unbound-eyebrow" }, "UNBOUND / DNS"),
              E("h2", {}, _("Unbound Performance Monitor")),
              E("p", {}, _("Resolver activity, cache efficiency and response times at a glance.")),
            ]),
          ]),
          E("div", { class: "unbound-update-info" }, [
            E("div", { id: "unbound-connection", class: "unbound-status", role: "status" }, [
              E("span", { class: "unbound-status-dot", "aria-hidden": "true" }),
              E("span", { id: "unbound-connection-label" }, _("Connecting")),
            ]),
            E("span", {}, _("Refresh interval") + ": " + POLL_INTERVAL + "s"),
            E("span", { id: "unbound-last-update" }, _("Waiting for data")),
          ]),
        ]),
        E("div", { id: "unbound-chart-tooltip", class: "unbound-chart-tooltip" }),
      ],
    );

    dashboardPage = page;

    page.appendChild(
      E(
        "div",
        { class: "unbound-monitor-grid" },
        [
          createCard(_("QPS"), "unbound-qps", "activity", _("Queries per second")),
          createCard(_("Total Queries"), "unbound-queries", "queries", _("Cumulative queries")),
          createCard(_("Cache Hit Rate"), "unbound-cache-hit", "cache", _("Including ECS cache hits")),
          createCard(
            _("Avg Recursion Time"),
            "unbound-recursion",
            "clock",
            _("Average resolution latency"),
            E("div", { class: "unbound-recursion-values" }, [
              E("span", { id: "unbound-recursion" }, "-"),
              E("small", { class: "unbound-recursion-median" }, [
                _("Median") + ": ",
                E("span", { id: "unbound-recursion-median" }, "-"),
              ]),
            ]),
          ),
          createCard(_("Bogus Answers"), "unbound-bogus", "shield", _("DNSSEC validation failures")),
          createCard(_("Runtime"), "unbound-uptime", "runtime", _("Time since service start")),
        ],
      ),
    );

    const tabs = E("div", { class: "unbound-monitor-tabs", role: "tablist", "aria-label": _("Unbound Monitor") });
    const tabDefinitions = [
      [_("Overview"), "overview", true],
      [_("Request List"), "requestlist", false],
      [_("Cache"), "cache", false],
      [_("Cachedb"), "cachedb", false],
      [_("Memory"), "memory", false],
      [_("Bogus"), "bogus", false],
      [_("Raw Stats"), "raw", false],
    ];

    tabDefinitions.forEach(function (definition) {
      tabs.appendChild(createTabButton.apply(null, definition));
    });
    page.appendChild(tabs);

    const overviewPanel = E(
      "div",
      { id: "unbound-tab-overview", class: "unbound-tab-panel" },
      [
        E(
          "div",
          { class: "unbound-chart-section" },
          [
            E("div", { class: "unbound-section-header" }, [
              E("div", {}, [
                E("h3", {}, _("QPS Trend")),
                E("p", {}, _("Recent query activity")),
              ]),
              E("div", { class: "unbound-chart-summary" }, [
                E("span", {}, [_("Current"), E("strong", { id: "unbound-qps-current" }, "-")]),
                E("span", {}, [_("Peak"), E("strong", { id: "unbound-qps-peak" }, "-")]),
              ]),
            ]),
            E("div", { class: "unbound-qps-container" }, [
              E("canvas", { id: "unbound-qps-chart", class: "unbound-chart", role: "img", "aria-label": _("QPS Trend") }),
            ]),
          ],
        ),
        E(
          "div",
          { class: "unbound-chart-section" },
          [
            E("div", { class: "unbound-section-header" }, [
              E("div", {}, [
                E("h3", {}, _("Response Time Histogram")),
                E("p", {}, _("Query counts by response time bucket")),
              ]),
              E("span", { class: "unbound-chart-legend" }, _("Queries")),
            ]),
            E(
              "div",
              { class: "unbound-histogram-scroll" },
              [E("canvas", { id: "unbound-histogram-chart", class: "unbound-chart", role: "img", "aria-label": _("Response Time Histogram") })],
            ),
          ],
        ),
      ],
    );

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
          { class: "unbound-stat-list" },
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
          { class: "unbound-stat-list" },
          [
            statRow(_("Message Cache"), "cache-msg"),
            statRow(_("RRSet Cache"), "cache-rrset"),
            statRow(_("Infra Cache"), "cache-infra"),
            statRow(_("Key Cache"), "cache-key"),
            statRow(_("Cache Hits"), "cache-hits"),
            statRow(_("Cache Misses"), "cache-misses"),
            statRow(_("Prefetch Queries"), "cache-prefetch"),
            statRow(_("ECS Cache Hits"), "cache-ecs"),
          ],
        ),
      ],
    );

    const cachedbPanel = E(
      "div",
      {
        id: "unbound-tab-cachedb",
        class: "unbound-tab-panel",
        style: "display:none",
      },
      [E("div", { class: "unbound-stat-list" }, [statRow(_("Cachedb Queries"), "cachedb")])],
    );

    const memoryPanel = E(
      "div",
      {
        id: "unbound-tab-memory",
        class: "unbound-tab-panel",
        style: "display:none",
      },
      [
        E(
          "div",
          { class: "unbound-stat-list" },
          [
            statRow(_("Displayed Memory Total"), "memory-total"),
            statRow(_("Message Cache Memory"), "memory-message"),
            statRow(_("RRSet Cache Memory"), "memory-rrset"),
            statRow(_("DNSCrypt Shared Secret Cache"), "memory-dnscrypt-secret"),
            statRow(_("DNSCrypt Nonce Cache"), "memory-dnscrypt-nonce"),
            statRow(_("Iterator Module"), "memory-iterator"),
            statRow(_("Validator Module"), "memory-validator"),
            statRow(_("Stream Wait Buffers"), "memory-streamwait"),
            statRow(_("HTTP Query Buffers"), "memory-http-query"),
            statRow(_("HTTP Response Buffers"), "memory-http-response"),
            statRow(_("QUIC Memory"), "memory-quic"),
          ],
        ),
      ],
    );

    const bogusPanel = E(
      "div",
      {
        id: "unbound-tab-bogus",
        class: "unbound-tab-panel",
        style: "display:none",
      },
      [
        E(
          "div",
          { class: "unbound-stat-list" },
          [
            statRow(_("Bogus Answers"), "bogus-answers"),
            statRow(_("Bogus RRsets"), "bogus-rrsets"),
            statRow(_("Secure Answers"), "secure-answers"),
            statRow(_("Validation Operations"), "validation-ops"),
          ],
        ),
      ],
    );

    const rawPanel = E(
      "div",
      { id: "unbound-tab-raw", class: "unbound-tab-panel", style: "display:none" },
      [E("pre", { id: "unbound-raw-stats", class: "unbound-raw-stats" })],
    );

    page.appendChild(overviewPanel);
    page.appendChild(requestPanel);
    page.appendChild(cachePanel);
    page.appendChild(cachedbPanel);
    page.appendChild(memoryPanel);
    page.appendChild(bogusPanel);
    page.appendChild(rawPanel);

    tabDefinitions.forEach(function (definition) {
      const panel = page.querySelector("#unbound-tab-" + definition[1]);

      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "unbound-nav-" + definition[1]);
      panel.setAttribute("tabindex", "0");
      if (definition[1] !== "overview") {
        panel.insertBefore(E("h3", { class: "unbound-detail-title" }, definition[0]), panel.firstChild);
      }
    });

    setupTabs(tabs);
    setupChartTooltips(page);

    loadChartLibrary(page, function () {
      drawQpsChart();
      drawHistogram(currentHistogram);
    });

    if (data && data.success && data.stats) updateDashboard(data.stats);
    else updateConnectionStatus(false);

    // Redraw after mounting, stylesheet loading and container width changes.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(function () {
        if (!page.isConnected) return;
        drawQpsChart();
        drawHistogram(currentHistogram);
      });

      observer.observe(page);
    }

    poll.add(
      L.bind(function () {
        return callStats()
          .then(function (result) {
            if (result && result.success && result.stats) updateDashboard(result.stats);
            else updateConnectionStatus(false);
          })
          .catch(function (error) {
            updateConnectionStatus(false);
            console.error("Failed to fetch Unbound stats", error);
          });
      }, this),
      POLL_INTERVAL,
    );

    return page;
  },
});
