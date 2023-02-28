// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';
import Localization from '../shared/localization.js';
import ApiHelper from '../shared/apiHelper.js';
import AppUtils from '../shared/appUtils.js';
import {
  AWSConsoleCongito,
} from '../shared/awsConsole.js';
import mxSpinner from '../mixins/mxSpinner.js';
import mxAlert from '../mixins/mxAlert.js';
import BaseTab from '../shared/baseTab.js';

const TITLE = Localization.Messages.UserManagementTab;
const DESCRIPTION = Localization.Messages.UserManagementDesc;
const USERNAME = Localization.Messages.Username;
const TABLE_HEADER = [
  USERNAME,
  Localization.Messages.Email,
  Localization.Messages.Group,
  Localization.Messages.Status,
  Localization.Messages.LastModified,
  Localization.Messages.RemoveUser,
];
const PERMISSION_VIEWER = Localization.Messages.PermissionViewer;
const PERMISSION_CREATOR = Localization.Messages.PermissionCreator;
const PERMISSION_ADMIN = Localization.Messages.PermissionAdmin;
const TOOLTIP_REMOVE_USER = Localization.Tooltips.RemoveUserFromCognito;
const TOOLTIP_REFRESH_USER_TABLE = Localization.Tooltips.RefreshUserTable;
const LIST_OF_CURRENT_USERS = Localization.Messages.CurrentUsers;
const CREATE_NEW_USERS = Localization.Messages.CreateNewUsers;
const CREATE_NEW_USERS_DESC = Localization.Messages.CreateNewUsersDesc;
const BTN_ADD_EMAIL = Localization.Buttons.AddEmail;
const BTN_CONFIRM_AND_ADD = Localization.Buttons.ConfirmAndAddUsers;
const BTN_REFRESH = Localization.Buttons.Refresh;
const OOPS = Localization.Alerts.Oops;
const ERR_INVALID_EMAIL_ADDRESS = Localization.Alerts.InvalidEmailAddress;
const ERR_INVALID_USERNAME = Localization.Alerts.UsernameConformance;
const ERR_NO_USER_TO_ADD = Localization.Alerts.NoNewUsers;
const ERR_FAIL_ADDIND_USERS = Localization.Alerts.FailAddingUsers;

export default class UserManagementTab extends mxAlert(mxSpinner(BaseTab)) {
  constructor(defaultTab = false) {
    super(TITLE, {
      selected: defaultTab,
    });
    this.$uid = AppUtils.randomHexstring();
  }

  get uid() {
    return this.$uid;
  }

  async show() {
    if (!this.initialized) {
      const content = await this.createContent();
      this.tabContent.append(content);
    }
    return super.show();
  }

  async createContent() {
    const container = $('<div/>')
      .addClass('row no-gutters');

    const sectionDesc = this.createDescriptionSection();
    container.append(sectionDesc);

    const sectionUserTable = await this.createUserTableSection();
    container.append(sectionUserTable);

    const sectionAddUsers = this.createAddUsersSection();
    container.append(sectionAddUsers);

    const loading = this.createLoading();
    container.append(loading);

    return container;
  }

  createDescriptionSection() {
    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');

    const url = AWSConsoleCongito.getUserPoolLink(SolutionManifest.Cognito.UserPoolId);
    let desc = DESCRIPTION.replace('{{CONSOLE_USERPOOL}}', url);
    desc = $('<p/>').addClass('lead')
      .html(desc);
    container.append(desc);

    return container;
  }

  async createUserTableSection() {
    const usersPromise = ApiHelper.getUsers();

    const container = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4 vh-30');

    const sectionTitle = $('<div/>')
      .addClass('col-12 p-0 mb-4 d-flex justify-content-between');
    container.append(sectionTitle);

    const heading = $('<span/>').addClass('lead')
      .append(LIST_OF_CURRENT_USERS);
    sectionTitle.append(heading);

    const refresh = $('<button/>').addClass('btn btn-sm btn-outline-dark')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REFRESH_USER_TABLE)
      .html(BTN_REFRESH)
      .tooltip({
        trigger: 'hover',
      });
    refresh.on('click', async () => {
      this.loading(true);
      await this.refreshUserTable();
      this.loading(false);
    });
    sectionTitle.append(refresh);

    const table = $('<table/>')
      .attr('id', `table-${this.uid}`)
      .addClass('table table-sm lead-xs no-border');
    container.append(table);

    const tbody = $('<tbody/>');
    table.append(tbody);

    const headers = this.makeTableHeaderRow();
    tbody.append(headers);

    const users = await usersPromise;

    const rowItems = users.map((user) =>
      this.makeTableRowItem(user));
    tbody.append(rowItems);

    return container;
  }

  makeTableHeaderRow() {
    const tr = $('<tr/>');

    const rows = TABLE_HEADER.map((x) =>
      $('<th/>').addClass('align-middle text-center lead-sm')
        .attr('scope', 'col')
        .append(x));
    tr.append(rows);
    return tr;
  }

  makeTableRowItem(user) {
    const tr = $('<tr/>')
      .attr('data-username', user.username);

    let permission;
    switch (user.group) {
      case SolutionManifest.Cognito.Group.Admin:
        permission = PERMISSION_ADMIN;
        break;
      case SolutionManifest.Cognito.Group.Creator:
        permission = PERMISSION_CREATOR;
        break;
      default:
        permission = PERMISSION_VIEWER;
    }
    permission = `${user.group}<br/>(${permission})`;

    const removeBtn = $('<button/>').addClass('btn btn-sm btn-outline-danger')
      .attr('type', 'button')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', TOOLTIP_REMOVE_USER)
      .append($('<i/>').addClass('far fa-trash-alt'))
      .tooltip({
        trigger: 'hover',
      });

    removeBtn.off('click').on('click', async () => {
      this.loading(true);
      removeBtn.tooltip('hide')
        .addClass('disabled')
        .attr('disabled', 'disabled');
      await this.onRemoveUser(user.username);
      tr.remove();
      this.loading(false);
    });

    const tds = [
      user.username,
      user.email,
      permission,
      user.status,
      new Date(user.lastModified).toISOString(),
      removeBtn,
    ].map((item) =>
      $('<td/>')
        .addClass('h-100 align-middle text-center col-2')
        .append(item || '--'));
    tr.append(tds);
    return tr;
  }

  createAddUsersSection() {
    const container = $('<div/>')
      .addClass('col-12 p-0 m-0 bg-light');

    const subContainer = $('<div/>')
      .addClass('col-9 p-0 mx-auto mt-4');
    container.append(subContainer);

    const heading = $('<span/>')
      .addClass('d-block p-0 lead mb-4')
      .append(CREATE_NEW_USERS);
    subContainer.append(heading);

    let description = CREATE_NEW_USERS_DESC
      .replace('{{ADD_EMAIL}}', BTN_ADD_EMAIL)
      .replace('{{CONFIRM_AND_ADD}}', BTN_CONFIRM_AND_ADD);
    description = $('<p/>')
      .addClass('lead-s')
      .append(description);
    subContainer.append(description);

    const addUserControls = this.createAddUserControls();
    subContainer.append(addUserControls);

    return container;
  }

  createAddUserControls() {
    const id = `form-${this.uid}`;
    const form = $('<form/>')
      .addClass('col-9 px-0 needs-validation')
      .attr('id', id)
      .attr('novalidate', 'novalidate');

    const btnGroup = $('<div/>').addClass('form-group mt-2');
    form.append(btnGroup);

    const addEmail = $('<button/>')
      .addClass('btn btn-primary btn-sm mb-2 mr-1')
      .attr('type', 'button')
      .html(BTN_ADD_EMAIL);
    btnGroup.append(addEmail);

    const confirm = $('<button/>')
      .addClass('btn btn-success btn-sm mb-2 mr-1')
      .attr('type', 'button')
      .html(BTN_CONFIRM_AND_ADD);
    btnGroup.append(confirm);

    addEmail.on('click', async (event) => {
      event.preventDefault();
      btnGroup.before(this.createEmailField());
      return true;
    });

    confirm.on('click', async (event) => {
      event.preventDefault();
      let users = [];

      const inputGrps = form.children('.input-group');
      inputGrps.each((k, inputGrp) => {
        const email = $(inputGrp).find('[data-attr-type="email"]').val();
        const group = $(inputGrp).find('select').val();
        let username = $(inputGrp).find('input[type="text"]').val();
        if (username === undefined || username.length === 0) {
          username = undefined;
        }
        if (email && group) {
          users.push({
            email,
            group,
            username,
          });
        }
      });
      if (!users.length) {
        this.shake(btnGroup);
        return this.showAlert(ERR_NO_USER_TO_ADD);
      }

      this.loading(true);
      users = await this.onAddNewUsers(users);
      this.loading(false);

      return inputGrps.children().remove();
    });

    return form;
  }

  async refreshUserTable(data) {
    const users = (data !== undefined)
      ? data.slice(0)
      : (await ApiHelper.getUsers());

    const tbody = this.tabContent
      .find(`table#table-${this.uid}`)
      .find('tbody');

    const rows = tbody.children('[data-username]');
    /* replace existing rows */
    rows.each((k, row) => {
      const current = $(row).data('username');
      const idx = users.findIndex((user) =>
        user.username === current);
      if (idx >= 0) {
        const found = users.splice(idx, 1)[0];
        const replacement = this.makeTableRowItem(found);
        $(row).replaceWith(replacement);
      }
    });
    /* process newly added rows */
    const rowItems = users.map((user) =>
      this.makeTableRowItem(user));
    tbody.append(rowItems);
  }

  createEmailField() {
    const inputGrp = $('<div/>')
      .addClass('input-group mb-2 mr-sm-2');
    const email = $('<input/>')
      .addClass('form-control col-3')
      .attr('data-attr-type', 'email')
      .attr('type', 'email')
      .attr('required', 'required')
      .attr('placeholder', '(Email)');
    inputGrp.append(email);

    const select = $('<select/>')
      .addClass('custom-select col-2')
      .attr('id', `select-${this.uid}`);
    inputGrp.append(select);

    const options = Object.values(SolutionManifest.Cognito.Group).map((group) =>
      $('<option/>')
        .attr('value', group)
        .html(group));
    options[0].attr('selected', 'selected');
    select.append(options);

    const username = $('<input/>')
      .addClass('form-control col-3')
      .attr('type', 'text')
      .attr('pattern', '[a-zA-Z0-9._%+-]{1,128}')
      .attr('placeholder', `(${USERNAME})`);
    inputGrp.append(username);

    const removeBtn = $('<button/>')
      .addClass('btn btn-secondary ml-1')
      .append($('<i/>').addClass('far fa-times-circle'));
    inputGrp.append(removeBtn);

    removeBtn.on('click', (event) => {
      event.preventDefault();
      inputGrp.remove();
    });

    [
      [
        email, ERR_INVALID_EMAIL_ADDRESS,
      ],
      [
        username, ERR_INVALID_USERNAME,
      ],
    ].forEach((x) => {
      x[0].focusout(async (event) => {
        const form = inputGrp.parent('form').first();
        if (!this.validateForm(event, form) && !x[0].get(0).validity.valid) {
          this.shake(inputGrp);
          await this.showAlert(x[1]);
          x[0].focus();
          return false;
        }
        return true;
      });

      x[0].keypress(async (event) => {
        if (event.which === 13) {
          const form = inputGrp.parent('form').first();
          if (!this.validateForm(event, form) && !x[0].get(0).validity.valid) {
            this.shake(inputGrp);
            await this.showAlert(x[1]);
            x[0].focus();
            return false;
          }
        }
        return true;
      });
    });

    return inputGrp;
  }

  validateForm(event, form) {
    event.preventDefault();
    if (form[0].checkValidity() === false) {
      event.stopPropagation();
      return false;
    }
    return true;
  }

  async showAlert(message, duration) {
    return super.showMessage(this.tabContent, 'danger', OOPS, message, duration);
  }

  async onRemoveUser(username) {
    return ApiHelper.deleteUser(username);
  }

  async onAddNewUsers(users) {
    const response = await ApiHelper.addUsers(users);

    const confirmed = response.filter((user) =>
      user.error === undefined);
    await this.refreshUserTable(confirmed);

    const errors = response.filter((user) =>
      user.error !== undefined);
    if (errors.length > 0) {
      console.error(errors);
      const emails = errors
        .map((user) =>
          `<strong>${user.email}</strong>`)
        .join(', ');
      const message = ERR_FAIL_ADDIND_USERS.replace('{{USERS}}', emails);
      await this.showAlert(message);
    }

    return confirmed;
  }
}
