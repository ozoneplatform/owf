Ext.define('Ozone.components.admin.stack.StackManagementPanel', {
    extend: 'Ozone.components.admin.ManagementPanel',
    alias: ['widget.stackmanagement'],
    
    layout: 'fit',
    
    gridStacks: null,
    pnlStackDetail: null,
    txtHeading: null,
    lastAction: null,
    guid_EditCopyWidget: null,
    
    widgetStateHandler: null,
    dragAndDrop: true,
    launchesWidgets: true,
    channel: 'AdminChannel',
    defaultTitle: 'Stacks',
    minButtonWidth: 80,
    detailsAutoOpen: true,
    
    initComponent: function() {
        
        var me = this;
        
        OWF.Preferences.getUserPreference({
            namespace: 'owf.admin.StackEditCopy',
            name: 'guid_to_launch',
            onSuccess: function(result) {
                me.guid_EditCopyWidget = result.value;
            },
            onFailure: function(err){ /* No op */
                me.showAlert('Preferences Error', 'Error looking up Stack Editor: ' + err);
            }
        });
        
        this.gridStacks = Ext.create('Ozone.components.admin.StacksGrid', {
            preventHeader: true,
            region: 'center',
            border: false
        });
        this.gridStacks.store.load({
        	params: {
                offset: 0,
                max: this.pageSize
            }
        });
        this.relayEvents(this.gridStacks, ['datachanged', 'select', 'deselect', 'itemdblclick']);
        
        this.pnlStackDetail = Ext.create('Ozone.components.admin.stack.StackDetailPanel', {
            layout: {
                type: 'fit',
                align: 'stretch'
            },
            region: 'east',
            preventHeader: true,
            collapseMode: 'mini',
            collapsible: true,
            collapsed: true,
            split: true,
            border: false,
            width: 200
        });
        
        this.txtHeading = Ext.create('Ext.toolbar.TextItem', {
            text: '<span class="heading-bold">'+this.defaultTitle+'</span>'
        });
        
        
        this.searchBox = Ext.widget('searchbox');

        this.items = [{
            xtype: 'panel',
            layout: 'border',
            border: false,
            items: [
                this.gridStacks,
                this.pnlStackDetail
            ]
        }];
        
        this.dockedItems = [{
            xtype: 'toolbar',
            dock: 'top',
            layout: {
                type: 'hbox',
                align: 'stretchmax'
            },
            items: [
                this.txtHeading,
            {
                xtype: 'tbfill'
            },
                this.searchBox
            ]
        }, {
            xtype: 'toolbar',
            dock: 'bottom',
            ui: 'footer',
            defaults: {
                minWidth: this.minButtonWidth
            },
            items: [{
                xtype: 'button', 
                text: 'Create',
                handler: function(button, evt) {
                    evt.stopPropagation();
                    me.doCreate();
                }
            }, {
                xtype: 'splitbutton',
                text: 'Edit',
                itemId: 'btnEdit',
                handler: function() {
                    var records = me.gridStacks.getSelectionModel().getSelection();
                    if (records && records.length > 0) {
                        for (var i = 0; i < records.length; i++) {
                            me.doEdit(records[i].data.id);
                        }
                    } else {
                        me.showAlert('Error', 'You must select at least one stack to edit.');
                    }
                },
                menu: {
                    xtype: 'menu',
                    plain: true,
                    hideMode: 'display',
                    defaults: {
                        minWidth: this.minButtonWidth
                    },
                    items: [
                        {
                            xtype: 'owfmenuitem',
                            text: 'Move Up',
                            handler: function(button, event) {
                                me.doMoveRow('up');
                            }
                        },
                        {
                            xtype: 'owfmenuitem',
                            text: 'Move Down',
                            handler: function(button, event) {
                                me.doMoveRow('down');
                            }
                        }
                    ]
                }
            }, {
                xtype: 'button', 
                text: 'Delete',
                itemId: 'btnDelete',
                handler: function(button) {
                    me.doDelete();
                }
            }]
        }];
    
        this.on(
            'datachanged',
            function(store, opts) {
                  //collapse and clear detail panel if the store is refreshed
                  if (this.pnlStackDetail != null ) {
                    this.pnlStackDetail.collapse();
                    this.pnlStackDetail.removeData();
                  }

                  //refresh launch menu
                  if (!this.disableLaunchMenuRefresh) {
                    this.refreshWidgetLaunchMenu();
                  }
            },
            this
        );
    
        this.on(
            'select',
            function(rowModel, record, index, opts) {
                this.pnlStackDetail.loadData(record);
                if (this.pnlStackDetail.collapsed && this.detailsAutoOpen) {this.pnlStackDetail.expand();}
            },
            this
        );
            
        this.searchBox.on(
            'searchChanged',
            function(searchbox, value) {
                this.gridStacks.applyFilter(value, ['name', 'description', 'stackContext']);
            },
            this
        );

        this.on(
             'itemdblclick',
             function(view, record, item, index, evt, opts) {
                 this.doEdit(record.data.id);
             },
             this
         );

        this.gridStacks.getView().on('itemkeydown', function(view, record, dom, index, evt) {
            switch(evt.getKey()) {
                case evt.SPACE:
                case evt.ENTER:
                    this.doEdit(record.data.id);
            }
        }, this);
        
        this.callParent(arguments);
        
        OWF.Eventing.subscribe('AdminChannel', owfdojo.hitch(this, function(sender, msg, channel) {
            if(msg.domain === 'Stack') {
                this.gridStacks.getBottomToolbar().doRefresh();
            }
        }));
        
        this.on(
            'afterrender', 
            function() {
                var splitterEl = this.el.down(".x-collapse-el");
                splitterEl.on('click', function() {
                    var collapsed = this.el.down(".x-splitter-collapsed");
                    if(collapsed) {
                        this.detailsAutoOpen = true;
                    }
                    else {
                        this.detailsAutoOpen = false;
                    }
                }, this);
            }, 
            this
            );
    },

    launchFailedHandler: function(response) {
        if (response.error) {
            this.showAlert('Launch Error', 'Stack Editor Launch Failed: ' + response.message);
        }
    },
    
    doEdit: function(id) {
        var dataString = Ozone.util.toString({
            id: id,
            copyFlag: false
        });
        
        OWF.Launcher.launch({
            guid: this.guid_EditCopyWidget,
            launchOnlyIfClosed: false,
            data: dataString
        }, this.launchFailedHandler);
    },
    
    doDelete: function() {
        var records = this.gridStacks.getSelectionModel().getSelection();
        if (records && records.length > 0) {

            var msg = 'This action will permanently delete ';
            if (records.length === 1) {
              msg += '<span class="heading-bold">' + Ext.htmlEncode(records[0].data.name) + '</span>.';
            }
            else {
              msg += 'the selected <span class="heading-bold">' + records.length + ' stacks</span>.';
            }
            this.showConfirmation('Warning', msg, function(btn, text, opts) {
                if (btn == 'ok') {
                    var store = this.gridStacks.getStore();
                    store.remove(records);
                    var remainingRecords = store.getTotalCount() - records.length;
                    store.on({
                       write: {
                         fn: function() {
                           if(store.data.items.length==0 && store.currentPage>1)
                           {
                               var lastPage = store.getPageFromRecordIndex(remainingRecords - 1);
                               var pageToLoad = (lastPage>=store.currentPage)?store.currentPage:lastPage;
                               store.loadPage(pageToLoad);
                           }
                           this.gridStacks.getBottomToolbar().doRefresh();
                           this.pnlStackDetail.removeData();
                           if (!this.pnlDashboardDetail.collapsed) {this.pnlDashboardDetail.collapse();}
                           this.refreshWidgetLaunchMenu();
                         },
                         scope: this,
                         single: true
                       }
                    });
                    store.save();
                }
            });
        } else {
            this.showAlert('Error', 'You must select at least one stack to delete.');
        }
    },
    
    doMoveRow: function(direction) {
        var stacks = this.gridStacks.getSelectionModel().getSelection();

        if (stacks && stacks.length > 0) {
            var store = this.gridStacks.getStore();

            //Sort them by stackPosition because are sorted by selection time now
            stacks.sort(function(a,b) {
                return a.get('stackPosition') - b.get('stackPosition');
            });

            if(direction === "up") {
                var firstPosition = 1;
                //If moving up, we have to start with the top-most selection
                for(var i = 0; i < stacks.length; i++) {
                    if(stacks[i].get('stackPosition') === firstPosition) {
                        //Don't move up since its already at the top, add 1 to the firstPosition
                        //so if the next row is selected too, it won't be moved up either
                        firstPosition++;
                    }
                    else {
                        //Not first position already, so move it up
                        stacks[i].set('stackPosition', stacks[i].get('stackPosition') - 1);
                    }
                }
            }
            else {
                var lastPosition = store.getCount();
                //If moving down, we have to start with the bottom-most selection
                for(var i = stacks.length - 1; i >= 0; i--) {
                    if(stacks[i].get('stackPosition') === lastPosition) {
                        //Don't move down since its already at the end, subtract 1 to the lastPosition
                        //so if the next row is selected too, it won't be moved down either
                        lastPosition--;
                    }
                    else {
                        //Not last position already, so move it down
                        stacks[i].set('stackPosition', stacks[i].get('stackPosition') + 1);
                    }
                }
            }

            //If records were updated, sync, refresh, and reselect rows
            if(store.getUpdatedRecords().length) {
                store.sync();

                store.on('write', function() {
                    this.gridStacks.refresh();
                }, this, {single: true});

                //After the store is loaded, reselect the selected stacks
                store.on('load', function(store, records, successful, operation) {
                    for(var i = 0; i < stacks.length; i++) {
                        this.gridStacks.getSelectionModel().select(store.indexOfId(stacks[i].get('id')), true);
                    }
                }, this, {single: true});
            }
        }
        else {
            this.showAlert('Error', 'You must select at least one stack to move.');
        }
    }
});
