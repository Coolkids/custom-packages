# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2021 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=geolite-mmdb
PKG_RELEASE:=$(shell date "+%Y-%m-%d")

PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Coolkid

include $(INCLUDE_DIR)/package.mk

GEOIP_FILE:=GeoLite2-Country.mmdb
define Download/geolite
  URL:=https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/
  URL_FILE:=GeoLite2-Country.mmdb
  FILE:=$(GEOIP_FILE)
  HASH:=skip
endef

define Package/geolite-mmdb/template
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=IP Addresses and Names
  URL:=https://github.com/P3TERX/GeoLite.mmdb
  PKGARCH:=all
endef

define Package/geolite-mmdb
  $(call Package/geolite-mmdb/template)
  TITLE:=MaxMind's GeoLite2 Country, City, and ASN databases
  VERSION:=$(PKG_RELEASE)
  LICENSE:=CC-BY-SA-4.0
endef

define Build/Prepare
	$(call Build/Prepare/Default)
ifneq ($(CONFIG_PACKAGE_geolite-mmdb),)
	$(call Download,geolite)
endif
endef

define Build/Compile
endef

define Package/geolite-mmdb/install
	$(INSTALL_DIR) $(1)/usr/share/geolite-mmdb
	$(INSTALL_DATA) $(DL_DIR)/$(GEOIP_FILE) $(1)/usr/share/geolite-mmdb/GeoLite2-Country.mmdb
endef

$(eval $(call BuildPackage,geolite-mmdb))