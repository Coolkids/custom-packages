# SPDX-License-Identifier: GPL-3.0-only
#
# Copyright (C) 2021 ImmortalWrt.org

include $(TOPDIR)/rules.mk

PKG_NAME:=doggo
PKG_VERSION:=1.1.3
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/mr-karan/doggo/tar.gz/v$(PKG_VERSION)?
PKG_HASH:=d1bca6ecd8d245e940528b6dba645c5a2e5f6293a3901d5b9166834e0aff4da5

PKG_MAINTAINER:=Coolkid
PKG_LICENSE:=GPLv3
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

GO_PKG:=github.com/mr-karan/doggo
GO_PKG_LDFLAGS_X:=main.VersionString=v$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

define Package/doggo
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=IP Addresses and Names
  TITLE:=Command-line DNS client for humans
  URL:=https://github.com/mr-karan/doggo
  DEPENDS:=$(GO_ARCH_DEPENDS)
endef

define Package/doggo/description
  doggo is a modern command-line DNS client (like dig) written in Golang. It outputs information in a neat concise manner and supports protocols like DoH, DoT, DoQ, and DNSCrypt as well.
  It's totally inspired from dog which is written in Rust. I wanted to add some features to it but since I don't know Rust, I found it as a nice opportunity to experiment with writing a DNS Client from scratch in Go myself. Hence the name dog +go => doggo.
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(GO_PKG_BUILD_BIN_DIR)/doggo $(1)/usr/bin/doggo
endef

$(eval $(call GoBinPackage,doggo))
$(eval $(call BuildPackage,doggo))
