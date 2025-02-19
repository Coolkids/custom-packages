# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2021 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=sing-geodata
PKG_RELEASE:=1
PKG_VERSION:=$(shell date "+%Y-%m-%d")

PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Coolkid

include $(INCLUDE_DIR)/package.mk

GEOIP_FILE:=geoip.db
define Download/geoip
  URL:=https://github.com/lyc8503/sing-box-rules/releases/latest/download/
  URL_FILE:=geoip.db
  FILE:=$(GEOIP_FILE)
  HASH:=skip
endef

GEOSITE_FILE:=geosite.db
define Download/geosite
  URL:=https://github.com/lyc8503/sing-box-rules/releases/latest/download/
  URL_FILE:=geosite.db
  FILE:=$(GEOSITE_FILE)
  HASH:=skip
endef

define Package/sing-geodata/template
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=IP Addresses and Names
  URL:=https://github.com/lyc8503/sing-box-rules
  PKGARCH:=all
endef

define Package/sing-geoip
  $(call Package/sing-geodata/template)
  TITLE:=GeoIP List for sing-box
  VERSION:=$(PKG_RELEASE)
  LICENSE:=CC-BY-SA-4.0
endef

define Package/sing-geosite
  $(call Package/sing-geodata/template)
  TITLE:=Geosite List for sing-box
  VERSION:=$(PKG_RELEASE)
  LICENSE:=MIT
endef

define Build/Prepare
	$(call Build/Prepare/Default)
ifneq ($(CONFIG_PACKAGE_sing-geoip),)
	$(call Download,geoip)
endif
ifneq ($(CONFIG_PACKAGE_sing-geosite),)
	$(call Download,geosite)
endif
endef

define Build/Compile
endef

define Package/sing-geoip/install
	$(INSTALL_DIR) $(1)/usr/share/singbox
	$(INSTALL_DATA) $(DL_DIR)/$(GEOIP_FILE) $(1)/usr/share/singbox/geoip.db
endef

define Package/sing-geosite/install
	$(INSTALL_DIR) $(1)/usr/share/singbox
	$(INSTALL_DATA) $(DL_DIR)/$(GEOSITE_FILE) $(1)/usr/share/singbox/geosite.db
endef

$(eval $(call BuildPackage,sing-geoip))
$(eval $(call BuildPackage,sing-geosite))