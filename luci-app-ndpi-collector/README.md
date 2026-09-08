# luci-app-ndpi-collector

LuCI page for time-bounded nDPI inspection of the current WAN physical device.

It starts `ndpiReader` in the background, stops it after the configured number
of seconds (at most 43200 seconds / 12 hours), and retains the newest ten
reports under `/tmp/ndpi-collector`. Each report has a generated summary and
the complete `ndpiReader` standard output. The LuCI report view visualizes
protocol byte distribution with `luci-lib-chartjs`, and also shows traffic
metrics, a packet-length distribution chart from `Traffic statistics`, a
protocol table, and the textual summary.

`ndpiReader` is optional in the `libndpi` package. Enable both
`CONFIG_PACKAGE_libndpi=y` and `CONFIG_LIBNDPI_NDPIREADER=y` before selecting
this package.
