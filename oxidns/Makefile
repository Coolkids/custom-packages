include $(TOPDIR)/rules.mk

PKG_NAME:=oxidns
PKG_VERSION:=1.2.2
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Coolkid

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE_URL:=https://github.com/svenshi/oxidns/releases/download/v$(PKG_VERSION)

PKG_HASH_X86_64_GLIBC:=89c77d917e7512787905748f88355360af192d76b7cacf4039e2d31569a73dce
PKG_HASH_X86_64_MUSL:=752986b299af5844621ce2ce743062cf8c4182a210f80ad154f9026ddf30fdac
PKG_HASH_AARCH64_GLIBC:=42e40deadeb1be9af0585658d4d8c3772aae501ef5d066bac0e73df037bebd7b
PKG_HASH_AARCH64_MUSL:=3cd14c1a06d9f4fcf21eeb48f6a8a75476f859d4e5178c7dcfdddce3507dfa8c

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