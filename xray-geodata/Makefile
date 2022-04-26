# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2021 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=xray-geodata
PKG_VERSION:=202204252212
PKG_RELEASE:=1

PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=Tianling Shen <cnsztl@immortalwrt.org>

include $(INCLUDE_DIR)/package.mk

GEOIP_VER:=202204252212 
GEOIP_FILE:=geoip.dat.xray.$(GEOIP_VER)
define Download/geoip
  URL:=https://github.com/Loyalsoldier/v2ray-rules-dat/releases/download/$(GEOIP_VER)/
  URL_FILE:=geoip.dat
  FILE:=$(GEOIP_FILE)
  HASH:=3659d8c74f02a88567b8843710d72758de4ed4e0ec09bd42a05029e02744a04d
endef

GEOSITE_VER:=202204252212 
GEOSITE_FILE:=geosite.dat.xray.$(GEOSITE_VER)
define Download/geosite
  URL:=https://github.com/Loyalsoldier/v2ray-rules-dat/releases/download/$(GEOSITE_VER)/
  URL_FILE:=geosite.dat
  FILE:=$(GEOSITE_FILE)
  HASH:=6775adf6977712a073fe27a3bd39fc18a2ca3fcac6473b3381dbd979b3e39d9a
endef

define Package/xray-geodata/template
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=IP Addresses and Names
  URL:=https://github.com/Loyalsoldier/v2ray-rules-dat
  PKGARCH:=all
endef

define Package/xray-geoip
  $(call Package/xray-geodata/template)
  TITLE:=GeoIP List for xray
  VERSION:=$(GEOIP_VER)-$(PKG_RELEASE)
  LICENSE:=CC-BY-SA-4.0
endef

define Package/xray-geosite
  $(call Package/xray-geodata/template)
  TITLE:=Geosite List for xray
  VERSION:=$(GEOSITE_VER)-$(PKG_RELEASE)
  LICENSE:=MIT
endef

define Build/Prepare
	$(call Build/Prepare/Default)
ifneq ($(CONFIG_PACKAGE_xray-geoip),)
	$(call Download,geoip)
endif
ifneq ($(CONFIG_PACKAGE_xray-geosite),)
	$(call Download,geosite)
endif
endef

define Build/Compile
endef

define Package/xray-geoip/install
	$(INSTALL_DIR) $(1)/usr/share/xray
	$(INSTALL_DATA) $(DL_DIR)/$(GEOIP_FILE) $(1)/usr/share/xray/geoip.dat
endef

define Package/xray-geosite/install
	$(INSTALL_DIR) $(1)/usr/share/xray
	$(INSTALL_DATA) $(DL_DIR)/$(GEOSITE_FILE) $(1)/usr/share/xray/geosite.dat
endef

$(eval $(call BuildPackage,xray-geoip))
$(eval $(call BuildPackage,xray-geosite))
