include $(TOPDIR)/rules.mk

PKG_NAME:=oxidns
PKG_VERSION:=1.2.1
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Coolkid

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE_URL:=https://github.com/svenshi/oxidns/releases/download/v$(PKG_VERSION)

PKG_HASH_X86_64_GLIBC:=7d6194ebe0eb411576b403a83ce7abeda9bf55e8c570aab6794bf33fa058dd56
PKG_HASH_X86_64_MUSL:=a5562e1250aed40c7f830152916d836e1fe45d0a7a8f6c5f1e2e827db7317acc
PKG_HASH_AARCH64_GLIBC:=88f446a70bccfffb14bcaed6c1344eb9c8df254426003000fb417716082cc84a
PKG_HASH_AARCH64_MUSL:=4337386203df9cfc0918d11f823a49df608555c75d0855ceb88f8a9349190700

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