include $(TOPDIR)/rules.mk

PKG_NAME:=oxidns
PKG_VERSION:=1.2.3
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Coolkid

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE_URL:=https://github.com/svenshi/oxidns/releases/download/v$(PKG_VERSION)

PKG_HASH_X86_64_GLIBC:=91730984795190c9ab432b1946bbddc8648c2704fe387f108d662944e5a1f4d2
PKG_HASH_X86_64_MUSL:=265b3f92faa39a86ab8956cb75ab3bc252438fe617fb5a4512c381dfa3681428
PKG_HASH_AARCH64_GLIBC:=a2b0f523098f68d5a1b04c6e698ff1c00102f62d5aba3ba1ffdc0fe88f88314f
PKG_HASH_AARCH64_MUSL:=09481e9654c2119bfb513f7fd8922c8976992d1f938e1a8b1464d48bfaf24124

include $(INCLUDE_DIR)/package.mk

ifeq ($(ARCH),x86_64)
    ifeq ($(CONFIG_USE_GLIBC),y)
        PKG_SOURCE:=oxidns-x86_64-unknown-linux-gnu.tar.gz
		PKG_HASH:=$(PKG_HASH_X86_64_GLIBC)
    else
        PKG_SOURCE:=oxidns-x86_64-unknown-linux-musl.tar.gz
		PKG_HASH:=$(PKG_HASH_X86_64_MUSL)
    endif
endif

ifeq ($(ARCH),aarch64)
    ifeq ($(CONFIG_USE_GLIBC),y)
        PKG_SOURCE:=oxidns-aarch64-unknown-linux-gnu.tar.gz
		PKG_HASH:=$(PKG_HASH_AARCH64_GLIBC)
    else
        PKG_SOURCE:=oxidns-aarch64-unknown-linux-musl.tar.gz
		PKG_HASH:=$(PKG_HASH_AARCH64_MUSL)
    endif
endif

define Package/oxidns
  SECTION:=net
  CATEGORY:=Network
  TITLE:=OxiDNS DNS Proxy
  URL:=https://github.com/svenshi/oxidns
  DEPENDS:=+ca-bundle
endef

define Package/oxidns/description
  High performance DNS proxy written in Rust.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(TAR) -xzf $(DL_DIR)/$(PKG_SOURCE) -C $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/oxidns/conffiles
/etc/oxidns/config.yaml
endef

define Package/oxidns/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) \
		$(PKG_BUILD_DIR)/oxidns \
		$(1)/usr/bin/oxidns

	$(INSTALL_DIR) $(1)/etc/oxidns

	$(INSTALL_CONF) \
		$(PKG_BUILD_DIR)/config.yaml \
		$(1)/etc/oxidns/config.yaml

	cp -a \
		$(PKG_BUILD_DIR)/webui \
		$(1)/etc/oxidns/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/oxidns.init \
		$(1)/etc/init.d/oxidns
endef

$(eval $(call BuildPackage,oxidns))