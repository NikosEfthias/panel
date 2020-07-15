import IziToast from "izitoast";
import { default as cfg, Config } from "./config";
import 'izitoast/dist/css/iziToast.css';
import "@coreui/icons/css/all.min.css";
import '../css/tables.css';
import Handlebars from "handlebars";
import { Request, User, TableGroup, Table, Wallet, Err } from "tombalaApi";
//@ts-ignore
import { Modal } from "@coreui/coreui";
import TranslateError from "./errMessagesTR";
interface GroupType {
  name: string,
  type: "SameCardSameRoomMultiBuy" | "SameCardMultiRoomBuy" | "UserBuysFromSingleTable",
}
const simdilikGroupTypes: GroupType[] = [
  { name: 'tr 0', type: "SameCardSameRoomMultiBuy" },
  { name: 'tr 1', type: "SameCardMultiRoomBuy" },
  { name: 'tr 2', type: "UserBuysFromSingleTable" }
];

class TableGroupsAndTables extends Request {
  myData?: User;
  wallets: Wallet[] = [];
  myTableGroups: TableGroup[] = [];
  groupTypes: GroupType[] = [];
  creditTemplate = fetch(require("../partials/credit.hbs")).then(d => d.text()).then(Handlebars.compile.bind(this));
  tableGroupsAndTablesTemplate = fetch(require("../partials/tableGroupsAndTables.hbs")).then(d => d.text()).then(Handlebars.compile.bind(this));
  addTableTemplate = fetch(require("../partials/addTable.hbs")).then(d => d.text()).then(Handlebars.compile.bind(this));
  editTableGroupTemplate = fetch(require("../partials/editTableGroup.hbs")).then(d => d.text()).then(Handlebars.compile.bind(this));
  delTableGroupTemplate = fetch(require('../partials/deleteTableGroup.hbs')).then(d => d.text()).then(Handlebars.compile.bind(this));
  editTableTemplate = fetch(require('../partials/editTable.hbs')).then(d => d.text()).then(Handlebars.compile.bind(this));
  delTableTemplate = fetch(require('../partials/deleteTable.hbs')).then(d => d.text()).then(Handlebars.compile.bind(this));
  modal: any;
  modalBody?: HTMLElement;
  cfg: Config = {} as Config;
  constructor(c: Config) {
    super(c)
    this.cfg = c;
    const that = this
    window.addEventListener("DOMContentLoaded", () => {
      const mdlEl = document.getElementById("actionModal") || undefined;
      that.modal = new Modal(mdlEl, {})
      that.modalBody = mdlEl?.querySelector(".modal-dialog") || undefined;
      that.getMyData()
        .then(d => {
          if (d.user_type != 'seller') Promise.reject(location.pathname = '/users.html');
          return Promise.resolve(that.myData = d)
        })
        .then(() => that.updateUiMydata());
      that.getMyTableGroups()
        .then(d => that.myTableGroups = d)
        .then(() => that.updateTableGroupUI());
      that.getGroupTypes()
        .then(d => that.groupTypes = d)
      that.addNewTableGroupUi();
      that.initWallet();
    })
  }
  initWallet() {
    const that = this;
    cfg()
      .catch(e => Promise.reject(IziToast.error({ title: 'Hata', message: e + '' })))
      .then(d => Promise.all(d.gameData.map(e => that.getGameData(e.id))))
      .catch(e => Promise.reject(IziToast.error({ title: 'Hata', message: e + '' })))
      .then(data => {
        data.forEach(d => {
          if (d.success) {
            that.wallets.push(d.data.wallet);
          }
        });
        that.updateUserCreditUI();
      })
  }
  updateUserCreditUI() {
    const el: HTMLElement | null = document.querySelector('#credits') || null;
    this.creditTemplate
      .then(t => t({ wallets: this.wallets }))
      .then(html => el && (el.innerHTML = html))
  }
  addNewTableGroupUi() {
    const that = this;
    const btn = document.getElementById("new_table_group_btn");
    function handleSubmit(el: HTMLFormElement | null | undefined) {
      return (e: Event) => {
        e.preventDefault();
        const tableGroupName = (el?.querySelector("input[type='text']") as HTMLInputElement | null);
        const tableGroupType = (el?.querySelector('#table-type-select') as HTMLInputElement | null);
        const checkbox = (el?.querySelector("input[type='checkbox']") as HTMLInputElement | null);
        if (!tableGroupName?.value) return tableGroupName?.focus();
        if (!tableGroupType?.value) return tableGroupType?.focus();
        if (!checkbox) return
        let _data: TableGroup = {
          id: -1,
          game_id: 1,
          name: tableGroupName.value,
          //@ts-ignore
          group_type: tableGroupType.value,
          is_bonus: checkbox.checked,
          seller_id: '_seller1',
          tables: [] as Table[]
        }
        that.addTableGroup(_data.game_id, _data.name + '', _data.group_type, _data.is_bonus)
          .catch(er => Promise.reject(IziToast.error({ title: 'Hata', message: er })))
          .then(({ data, reason, success }) => {
            if (!success) {
              const [title, msg] = TranslateError(reason as Err);
              return Promise.reject(IziToast.error({ title, message:msg||''}));
            }
            _data.id = data;
            that.myTableGroups.unshift(_data);
            that.updateTableGroupUI();
            that.modal.hide()
            return true
          })
      }
    }
    btn?.addEventListener("click", () => {
      const that = this;

      fetch(require("../partials/addTableGroup.hbs"))
        .then(d => d.text())
        .then(Handlebars.compile.bind(that))
        .then(t => {
          that.modalBody && (that.modalBody.innerHTML = t({ groupTypes: that.groupTypes }))
          const form = that.modalBody?.querySelector("form")
          that.modalBody?.querySelector("#submitNewTableGroup")?.addEventListener("click", handleSubmit(form))
          form?.addEventListener("submit", handleSubmit(form))
          that.modal.toggle()
        })
    })
  }

  onTableAddClickHandler(id: number) {
    const that = this;
    const tableGroup = this.myTableGroups.filter(tg => tg.id == id)[0];
    if (!tableGroup) return IziToast.error({ title: 'Hata', message: 'Böyle bir masa bulunamadı.' });
    that.addTableTemplate.then(t => {
      that.modalBody && (that.modalBody.innerHTML = t(tableGroup));
      this.modal.show();
      that.modalBody?.querySelector('#submitNewAddTable')?.addEventListener('click', () => {
        const formInputElems: HTMLInputElement[] = [].slice.call(that.modalBody?.querySelector("form")?.querySelectorAll('input'))
        //@ts-ignore
        let t: Table = {
          id: -1,
          group_id: id,
          name: formInputElems[0].value,
          price: parseInt(formInputElems[1].value),
          c1: parseInt(formInputElems[2].value),
          c2: parseInt(formInputElems[3].value),
          t: parseInt(formInputElems[4].value),
          tulum: parseInt(formInputElems[5].value),
          first_5:parseInt(formInputElems[6].value),
          first_10:parseInt(formInputElems[7].value),
          min_cards:parseInt(formInputElems[8].value),
        }
        that.addTable(t.group_id, t.name, t.price, t.c1, t.c2, t.t, t.tulum, t.first_5, t.first_10, t.min_cards)
          .catch(er => Promise.reject(IziToast.error({ title: 'Hata', message: er })))
          .then(({ data, reason, success }) => {
            if (!success) {
              const [title, msg] = TranslateError(reason as Err);
              return Promise.reject(IziToast.error({ title, message:msg||''}));
            }
            t.id = data;
            tableGroup.tables.push(t);
            that.updateTableGroupUI();
            that.modal.hide()
            return
          })
      })
    })
  }
  onTableGroupEditClickHandler(id: number) {
    const that = this;
    const tableGroup = this.myTableGroups.filter(tg => tg.id == id)[0];
    that.editTableGroupTemplate.then(t => {
      that.modalBody && (that.modalBody.innerHTML = t(tableGroup));
      this.modal.show();
      this.modalBody?.querySelector('#saveTableGroupData')?.addEventListener('click', () => {
        const name = (that.modalBody?.querySelector('input[type="text"]') as HTMLInputElement).value;
        tableGroup.name = name;
        that.updateTableGroupUI();
        that.modal.hide()
      })
    })
  }
  onTableGroupDeleteClickHandler(id: number) {
    const that = this;
    const tableGroup = this.myTableGroups.filter(tg => tg.id == id)[0];
    that.delTableGroupTemplate.then(t => {
      that.modalBody && (that.modalBody.innerHTML = t(tableGroup));
      this.modal.show();
      this.modalBody?.querySelector('#doDeleteTableGroup')?.addEventListener('click', () => {
        that.deleteTableGroup(id)
          .catch(er => Promise.reject(IziToast.error({ title: 'Hata', message: er })))
          .then(({ data, reason, success }) => {
            if (!success) {
              const [title, msg] = TranslateError(reason as Err);
              return Promise.reject(IziToast.error({ title, message:msg||''}));
            }
            that.myTableGroups.forEach((e, i) => {
              if (e.id == id) that.myTableGroups.splice(i, 1);
            })
            that.updateTableGroupUI();
            that.modal.hide()
            return
          })
      })
    })
  }
  onTableEditClickHandler(tableGroupID: number, id: number) {
    const that = this;
    const _table = this.myTableGroups.filter(tg => tg.id == tableGroupID)[0].tables.filter(t => t.id == id)[0];
    that.editTableTemplate.then(t => {
      that.modalBody && (that.modalBody.innerHTML = t(_table));
      this.modal.show();
      this.modalBody?.querySelector('#saveTableGroupData')?.addEventListener('click', () => {

        const formInputElems: HTMLInputElement[] = [].slice.call(that.modalBody?.querySelector("form")?.querySelectorAll('input'));
        let table: Table = {} as Table;
        table.id = id;
        table.group_id = tableGroupID;
        if (formInputElems[0].value) table.name = formInputElems[0].value;
        if (formInputElems[1].value) table.price = parseInt(formInputElems[1].value);
        if (formInputElems[2].value) table.c1 = parseInt(formInputElems[2].value);
        if (formInputElems[3].value) table.c2 = parseInt(formInputElems[3].value);
        if (formInputElems[4].value) table.t = parseInt(formInputElems[4].value);
        if (formInputElems[5].value) table.tulum = parseInt(formInputElems[5].value);
        if (formInputElems[6].value) table.first_5 = parseInt(formInputElems[6].value);
        if (formInputElems[7].value) table.first_10 = parseInt(formInputElems[7].value);
        if (formInputElems[8].value) table.min_cards = parseInt(formInputElems[8].value);
        that.updateTable(id, table)
          .catch(er => Promise.reject(IziToast.error({ title: 'Hata', message: er })))
          .then(({ data, reason, success }) => {
            if (!success) {
              const [title, msg] = TranslateError(reason as Err);
              return Promise.reject(IziToast.error({ title, message:msg||''}));
            }
            that.myTableGroups.filter(()=>id=table.group_id)[0].tables.forEach((e)=>{
              if(e.id==table.id) Object.assign(e,table);
              console.log(e,table);
            })
            that.updateTableGroupUI();
            that.modal.hide()
            return
          })
      })
    })
  }
  onTableDeleteClickHandler(tableGroupID: number, id: number) {
    const that = this;
    const table = this.myTableGroups.filter(tg => tg.id == tableGroupID)[0].tables.filter(t => t.id == id)[0];
    that.delTableTemplate.then(t => {
      that.modalBody && (that.modalBody.innerHTML = t(table));
      this.modal.show();
      this.modalBody?.querySelector('#doDeleteTable')?.addEventListener('click', () => {
        that.deleteTable(id)
          .catch(er => Promise.reject(IziToast.error({ title: 'Hata', message: er })))
          .then(({ data, reason, success }) => {
            if (!success) {
              const [title, msg] = TranslateError(reason as Err);
              return Promise.reject(IziToast.error({ title, message:msg||''}));
            }
            that.myTableGroups.forEach((tg, index) => {
              if (tg.id == tableGroupID) {
                tg.tables.forEach((t, i) => {
                  if (t.id == id) that.myTableGroups[index].tables.splice(i, 1);
                })
              }

            })
            that.updateTableGroupUI();
            that.modal.hide()
            return
          })
      })
    })
  }
  updateTableGroupUI() {
    const that = this;
    const el = document.querySelector("#accordion-table-groups-and-tables")
    that.tableGroupsAndTablesTemplate.then(t => {
      return t({
        tableGroups: that.myTableGroups,
      })
    }).then(tpl => {
      el && (el.innerHTML = tpl)
    })
  }
  updateUiMydata() {
    const that = this;
    const me_id_el = document.querySelector("#me_id");
    me_id_el && (me_id_el.innerHTML = that.myData?.id || "")
  }
  async getMyData(): Promise<User> {
    return this.me()
      .catch(e => Promise.reject(IziToast.error({ title: 'Hata', message: e })))
      .then(({ success, data, reason }) => {
        if (!success) {
          const [title, msg] = TranslateError(reason as Err);
          return Promise.reject(IziToast.error({ title, message:msg||''}));
        }
        if (data.user_type == 'user')
          location.pathname = '/index.html';
        return data;
      })
  }
  async getMyTableGroups(): Promise<TableGroup[]> {
    return this.getGameData(1)
      .catch(e => Promise.reject(IziToast.error({ title: 'Hata', message: e })))
      .then(({ success, data, reason }) => {
        if (!success) {
          const [title, msg] = TranslateError(reason as Err);
          return Promise.reject(IziToast.error({ title, message:msg||''}));
        }
        return data.table_groups;
      })
  }
  async getGroupTypes(): Promise<GroupType[]> {
    return simdilikGroupTypes;
  }
}

cfg().then(c =>
  //@ts-ignore
  window.ctx = new TableGroupsAndTables(c)
)

