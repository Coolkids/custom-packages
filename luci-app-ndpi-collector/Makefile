#
# Copyright (C) 2026
#
# This is free software, licensed under the Apache License, Version 2.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ndpi-collector
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Coolkid

LUCI_TITLE:=LuCI support for nDPI WAN traffic collection
LUCI_DEPENDS:=+libndpi +@LIBNDPI_NDPIREADER +jsonfilter +luci-lib-chartjs
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
