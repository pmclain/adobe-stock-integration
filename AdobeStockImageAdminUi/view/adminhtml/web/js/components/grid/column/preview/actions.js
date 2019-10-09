/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
define([
    'uiComponent',
    'jquery',
    'Magento_AdobeStockImageAdminUi/js/model/messages',
    'Magento_AdobeStockImageAdminUi/js/media-gallery',
    'Magento_Ui/js/modal/confirm',
    'Magento_Ui/js/modal/prompt',
    'text!Magento_AdobeStockImageAdminUi/template/modal/adobe-modal-prompt-content.html'
], function (Component, $, messages, mediaGallery, confirmation, prompt, adobePromptContentTmpl) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Magento_AdobeStockImageAdminUi/grid/column/preview/actions',
            loginProvider: 'name = adobe-login, ns = adobe-login',
            previewProvider: 'name = adobe_stock_images_listing.adobe_stock_images_listing.adobe_stock_images_columns.preview, ns = ${ $.ns }',
            mediaGallerySelector: '.media-gallery-modal:has(#search_adobe_stock)',
            adobeStockModalSelector: '#adobe-stock-images-search-modal',
            downloadImagePreviewUrl: 'adobe_stock/preview/download',
            licenseAndDownloadUrl: 'adobe_stock/license/license',
            confirmationUrl: 'adobe_stock/license/confirmation',
            buyCreditsUrl: 'https://stock.adobe.com/',
            messageDelay: 5,
            modules: {
                login: '${ $.loginProvider }',
                preview: '${ $.previewProvider }'
            }
        },

        /**
         * Returns is_downloaded flag as observable for given record
         *
         * @returns {observable}
         */
        isDownloaded: function () {
            return this.preview().displayedRecord().is_downloaded;
        },

        /**
         * Returns is_licensed flag as observable for given record
         *
         * @returns {observable}
         */
        isLicensed: function() {
            return this.preview().displayedRecord().is_licensed;
        },

        /**
         * Locate downloaded image in media browser
         */
        locate: function () {
            $(this.preview().adobeStockModalSelector).trigger('closeModal');
            mediaGallery.locate(this.preview().displayedRecord().path);
        },

        /**
         * Save preview
         */
        savePreview: function () {
            prompt({
                title: 'Save Preview',
                content: 'File Name',
                value: this.generateImageName(this.preview().displayedRecord()),
                imageExtension: this.getImageExtension(this.preview().displayedRecord()),
                promptContentTmpl: adobePromptContentTmpl,
                modalClass: 'adobe-stock-save-preview-prompt',
                validation: true,
                promptField: '[data-role="promptField"]',
                validationRules: ['required-entry'],
                attributesForm: {
                    novalidate: 'novalidate',
                    action: '',
                    onkeydown: 'return event.key != \'Enter\';'
                },
                attributesField: {
                    name: 'name',
                    'data-validate': '{required:true}',
                    maxlength: '128'
                },
                context: this,
                actions: {
                    confirm: function (fileName) {
                        this.save(this.preview().displayedRecord(), fileName, this.preview().downloadImagePreviewUrl);
                    }.bind(this)
                },
                buttons: [{
                    text: $.mage.__('Cancel'),
                    class: 'action-secondary action-dismiss'
                }, {
                    text: $.mage.__('Confirm'),
                    class: 'action-primary action-accept'
                }]
            });
        },

        /**
         * Save record as image
         *
         * @param {Object} record
         * @param {String} fileName
         * @param {String} actionURI
         */
        save: function (record, fileName, actionURI) {
            var mediaBrowser = $(this.preview().mediaGallerySelector).data('mageMediabrowser'),
                destinationPath = (mediaBrowser.activeNode.path || '') + '/' + fileName + '.' + this.getImageExtension(record);

            $.ajax({
                type: 'POST',
                url: actionURI,
                dataType: 'json',
                showLoader: true,
                data: {
                    'media_id': record.id,
                    'destination_path': destinationPath
                },
                context: this,
                success: function () {
                    var displayedRecord = this.preview().displayedRecord();
                    displayedRecord.is_downloaded = 1;
                    displayedRecord.path = destinationPath;
                    this.preview().displayedRecord(displayedRecord);
                    $(this.preview().adobeStockModalSelector).trigger('closeModal');
                    mediaBrowser.reload(true);
                },
                error: function (response) {
                    messages.add('error', response.message);
                    messages.scheduleCleanup(3);
                }
            });
        },

        /**
         * Generate meaningful name image file
         *
         * @param {Object} record
         * @return string
         */
        generateImageName: function (record) {
            var imageName = record.title.substring(0, 32).replace(/\s+/g, '-').toLowerCase();
            return imageName;
        },

        /**
         * Get image file extension
         *
         * @param {Object} record
         * @return string
         */
        getImageExtension: function (record) {
            var imageType = record.content_type.match(/[^/]{1,4}$/);
            return imageType;
        },

        /**
         * Get messages
         *
         * @return {Array}
         */
        getMessages: function () {
            return messages.get();
        },

        /**
         * License and save image
         *
         * @param {Object} record
         */
        licenseAndSave: function (record) {
            this.save(record, this.generateImageName(record), this.preview().licenseAndDownloadUrl);
        },

        /**
         * Shows license confirmation popup with information about current license quota
         *
         * @param {Object} record
         */
        showLicenseConfirmation: function (record) {
            var licenseAndSave = this.licenseAndSave.bind(this);
            $.ajax(
                {
                    type: 'POST',
                    url: this.preview().confirmationUrl,
                    dataType: 'json',
                    data: {
                        'media_id': record.id
                    },
                    context: this,
                    showLoader: true,

                    success: function (response) {
                        var confirmationContent = $.mage.__('License "' + record.title + '"'),
                            quotaMessage = response.result.message,
                            canPurchase = response.result.canLicense;
                        confirmation({
                            title: $.mage.__('License Adobe Stock Image?'),
                            content: confirmationContent + '<p><b>' + quotaMessage + '</b></p>',
                            actions: {
                                confirm: function () {
                                    if (canPurchase) {
                                        licenseAndSave(record);
                                    } else {
                                        window.open(this.preview().buyCreditsUrl);
                                    }
                                }
                            },
                            buttons: [{
                                text: $.mage.__('Cancel'),
                                class: 'action-secondary action-dismiss',
                                click: function () {
                                    this.closeModal();
                                }
                            }, {
                                text: canPurchase ? $.mage.__('OK') : $.mage.__('Buy Credits'),
                                class: 'action-primary action-accept',
                                click: function () {
                                    this.closeModal();
                                    this.options.actions.confirm();
                                }
                            }]
                        })
                    },

                    error: function (response) {
                        messages.add('error', response.responseJSON.message);
                        messages.scheduleCleanup(3);
                    }
                }
            );
        },

        /**
         * Process of license
         */
        licenseProcess: function () {
            this.login().login()
                .then(function () {
                    this.showLicenseConfirmation(this.preview().displayedRecord());
                }.bind(this))
                .catch(function (error) {
                    messages.add('error', error.message);
                })
                .finally((function () {
                    messages.scheduleCleanup(this.messageDelay);
                }).bind(this));
        },

        /**
         * Returns license button title depending on the existing saved preview
         *
         * @returns {String}
         */
        getLicenseButtonTitle: function () {
            return this.isDownloaded() ?  $.mage.__('License') : $.mage.__('License and Save')
        }
    });
});
