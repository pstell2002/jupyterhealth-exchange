// ==================================================
// Global Constants
// ==================================================

const ROUTE_PREFIX = "/portal/";
const DEFAULT_ROUTE = "organizations";
const API_PATH = "/api/v1/";

const ROUTES = {
  // dashboard: {
  //   label: "Dashboard",
  //   iconClass: "bi-speedometer",
  //   action: "renderDashboard",
  // },
  organizations: {
    label: "Organizations",
    iconClass: "bi-diagram-3",
    action: "renderOrganizations",
  },
  patients: {
    label: "Patients",
    iconClass: "bi-person-vcard",
    action: "renderPatients",
  },
  studies: {
    label: "Studies",
    iconClass: "bi-journals",
    action: "renderStudies",
  },
  observations: {
    label: "Observations",
    iconClass: "bi-database",
    action: "renderObservations",
  },
  dataSources: {
    label: "Data Sources",
    iconClass: "bi-phone",
    action: "renderDataSources",
  },
  debug: {
    label: "Debug",
    iconClass: "bi-bug",
    action: "renderDebug",
  },
};

// ==================================================
// Global Vars
// ==================================================

const actions = {
  renderOrganizations,
  renderPatients,
  renderStudies,
  renderObservations,
  renderDataSources,
  renderDebug,
};
let crudModal;
let store = {};
let userProfile = {};
let signingOut = false;

// ==================================================
// Common
// ==================================================

async function app() {
  let currentRouteAndParams = getCurrentRouteAndParams();
  if (!ROUTES[currentRouteAndParams.route])
    currentRouteAndParams.route = DEFAULT_ROUTE;
  await nav(currentRouteAndParams.route, currentRouteAndParams.params);
}

async function nav(newRoute, queryParams, appendQueryParams) {
  const newRouteSettings = ROUTES[newRoute];

  const currentRouteAndParams = getCurrentRouteAndParams();
  if (!queryParams) {
    if (appendQueryParams) {
      queryParams = { ...currentRouteAndParams.params, ...appendQueryParams };
    } else {
      queryParams = {};
    }
  }

  const body = Handlebars.compile(document.getElementById("t-body").innerHTML);

  if (!(await userManager.getUser())) {
    await userManager.signinRedirect();
  }

  const mainContent = await actions[newRouteSettings.action](queryParams);
  const elementMainContent = document.getElementById("mainContent");
  if (elementMainContent) elementMainContent.remove();

  navItems = [];
  for (const [route, settings] of Object.entries(ROUTES)) {
    settings.active = route === newRoute;
    settings.route = route;
    navItems.push(settings);
  }

  const baseBodyElement = document.getElementById("baseBody");

  document
    .querySelectorAll("#baseBody > main")
    .forEach((child) => baseBodyElement.removeChild(child));

  document.getElementById("baseBody").insertAdjacentHTML("afterbegin", body({
    navItems: navItems,
    mainContent: mainContent,
  }));

  renderUserProfile();

  const crudModalElement = document.getElementById(`${newRoute}-crudModal`);
  if (crudModalElement) {
    crudModal = new bootstrap.Modal(crudModalElement, {});
  }

  if (
    queryParams.create ||
    queryParams.read ||
    queryParams.update ||
    queryParams.delete
  ) {
    crudModal.show();
  }

  if (
    newRoute != currentRouteAndParams.route ||
    !isShallowEq(queryParams, currentRouteAndParams.params)
  ) {
    window.history.pushState(
      {},
      "",
      ROUTE_PREFIX +
        newRoute +
        "?" +
        new URLSearchParams(queryParams).toString()
    );
  }
}

function navReload() {
  clearModalValidationErrors();
  if (crudModal._isShown) crudModal.hide();
  const currentRouteAndParams = getCurrentRouteAndParams();
  nav(currentRouteAndParams.route, currentRouteAndParams.params);
}

window.addEventListener("popstate", function (event) {
  console.log("popstate", JSON.stringify(event));
  if (!signingOut) navReload(); // see signOut() for explanation
});

function navReturnFromCrud() {
  const currentRouteAndParams = getCurrentRouteAndParams();
  const params = currentRouteAndParams.params;
  delete params.create;
  delete params.read;
  delete params.update;
  delete params.delete;
  crudModal.hide();
  nav(currentRouteAndParams.route, params);
}

function getCurrentRouteAndParams() {
  let currentRoute = window.location.pathname.substring(ROUTE_PREFIX.length);
  if (currentRoute.endsWith("/")) currentRoute = currentRoute.slice(0, -1);
  const params = Object.fromEntries(
    new URLSearchParams(document.location.search)
  );
  return {
    route: currentRoute,
    params: params,
  };
}

async function apiRequest(method, resourcePath, params) {
  console.log(
    `apiRequest: ${method} ${resourcePath} ${JSON.stringify(params)}`
  );
  const headers = {
    "Cache-Control": "no-cache",
  };
  const user = await userManager.getUser();
  if (user) headers["Authorization"] = `Bearer ${user.access_token}`;
  let url = API_PATH + resourcePath;
  let body;
  if (params) {
    if (method === "GET") {
      url = `${url}?${new URLSearchParams(params).toString()}`;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(params);
    }
  }
  let response = null;
  try {
    response = await fetch(url, {
      method: method,
      headers: headers,
      body: body,
    });
    console.log(
      `apiRequest response: ${response.status} ${response.statusText}`
    );
    // Unauthorized
    if (parseInt(response.status) == 401) {
      await userManager.signinRedirect();
      return;
    } else if (parseInt(response.status) == 400) {
      displayModalValidationError(await response.json());
      return;
    } else if (parseInt(response.status) > 299) {
      displayError(response.statusText);
      return;
    }
  } catch (error) {
    displayError(error);
    console.log(`apiRequest Error: ${error}`);
  }
  return response;
}

function renderDebug(param) {
  const content = Handlebars.compile(
    document.getElementById("t-debug").innerHTML
  );
  setTimeout(() => {
    ["debugOAuthPayload", "debugPatientConsentsUrl"].forEach((element) => {
      document.getElementById(element).value = document
        .getElementById(element)
        .value.replace("SITE_URL", CONSTANTS.SITE_URL);
    });
  }, 2000);
  return content({});
}

function displayError(messageDetail) {
  const MESSAGE =
    "An Error has occured. Please click your browser Refresh button and try again.";
  const e = document.getElementById("errorAlert");
  e.innerHTML = `${MESSAGE}<br/><small>Detail: ${messageDetail}</small>`;
  e.style.display = "block";
}

function displayModalValidationError(messages) {
  let htmlMesssage = "";
  if (Array.isArray(messages)) {
    htmlMesssage = messages.join("; ");
  } else {
    Object.keys(messages).forEach((field) => {
      htmlMesssage += `<li>${field} - ${messages[field][0]}</li>`;
    });
  }
  document.querySelectorAll(".validationError").forEach((e) => {
    e.innerHTML = `<small>Validation Error(s): ${htmlMesssage}</small>`;
    e.style.display = "block";
  });
}

function clearModalValidationErrors() {
  document.querySelectorAll(".validationError").forEach((e) => {
    e.style.display = "none";
  });
}

// ==================================================
// User Profile
// ==================================================

async function getUserProfile() {
  const user = await userManager.getUser();
  const userProfileResponse = await apiRequest("GET", `users/profile`);
  const localUserProfile = await userProfileResponse.json();
  if (parseInt(user.profile.sub) !== parseInt(localUserProfile.id)) signOut();
  return localUserProfile;
}

async function renderUserProfile() {
  if (!userProfile || !userProfile.email) {
    userProfile = await getUserProfile();
  }
  let displayName = userProfile.email.substring(0,12)+'...';
  // if (userProfile.firstName && userProfile.lastName) {
  //   displayName = `${userProfile.firstName} ${userProfile.lastName}`
  // }
  document.getElementById("profileUsername").textContent = displayName;
}

/**
 * userManager.removeUser() raises an event which triggers
 * the popstate listner which calls navReload to catch back
 * button events. Skip this for signout otherwise redirect
 * is never processed.
 */
async function signOut() {
  signingOut = true;
  await userManager.removeUser();
  this.document.location = "/accounts/logout";
}

// ==================================================
// Organizations
// ==================================================

async function renderOrganizations(queryParams) {
  console.log(`queryParams: ${JSON.stringify(queryParams)}`);
  const content = Handlebars.compile(
    document.getElementById("t-organizations").innerHTML
  );
  const topLevelOrganizationsResponse = await apiRequest(
    "GET",
    "organizations",
    {
      partOf: CONSTANTS.ORGANIZATION_TOP_LEVEL_PART_OF_ID,
    }
  );
  const topLevelOrganizationsPaginated =
    await topLevelOrganizationsResponse.json();
  let topLevelOrganizationsSelect = topLevelOrganizationsPaginated.results;
  let organizationTreeChildren = [];
  // If a top level organization is selected
  if (queryParams.tloId && queryParams.tloId != 0) {
    topLevelOrganizationsSelect = topLevelOrganizationsSelect.map(
      (organization) => {
        organization.selected = organization.id === parseInt(queryParams.tloId);
        return organization;
      }
    );
    const organizationTreeResaponse = await apiRequest(
      "GET",
      `organizations/${queryParams.tloId}/tree`
    );
    const organizationTree = await organizationTreeResaponse.json();
    organizationTreeChildren = organizationTree.children;
  }

  let organizationRecord, partOfId, partOfName;

  if (queryParams.create) {
    if (
      queryParams.partOf &&
      queryParams.partOf == CONSTANTS.ORGANIZATION_TOP_LEVEL_PART_OF_ID
    ) {
      partOfId = CONSTANTS.ORGANIZATION_TOP_LEVEL_PART_OF_ID;
      partOfName = CONSTANTS.ORGANIZATION_TOP_LEVEL_PART_OF_LABEL;
    } else {
      partOfId = queryParams.partOf ? queryParams.partOf : queryParams.id;
      const organizationRecordPartOfResponse = await apiRequest(
        "GET",
        `organizations/${partOfId}`
      );
      const organizationRecordPartOf =
        await organizationRecordPartOfResponse.json();
      partOfId = organizationRecordPartOf.id;
      partOfName = organizationRecordPartOf.name;
    }
    organizationRecord = {
      partOfId: partOfId,
      partOfName: partOfName,
      typeSelect: buildSelectOptions(CONSTANTS.ORGANIZATION_TYPES, null, [
        "root",
      ]),
    };
  } else if (queryParams.update || queryParams.read || queryParams.delete) {
    const organizationRecordResponse = await apiRequest(
      "GET",
      `organizations/${queryParams.id}`
    );
    organizationRecord = await organizationRecordResponse.json();
    organizationRecord.typeSelect = buildSelectOptions(
      CONSTANTS.ORGANIZATION_TYPES,
      organizationRecord.type,
      ["root"]
    );

    if (
      organizationRecord.partOf == CONSTANTS.ORGANIZATION_TOP_LEVEL_PART_OF_ID
    ) {
      organizationRecord.partOfName =
        CONSTANTS.ORGANIZATION_TOP_LEVEL_PART_OF_LABEL;
    } else {
      const organizationRecordParentResponse = await apiRequest(
        "GET",
        `organizations/${organizationRecord.partOf}`
      );
      const organizationRecordParent =
        await organizationRecordParentResponse.json();
      organizationRecord.partOfName = organizationRecordParent.name;
    }

    if (queryParams.read) {
      const organizationUsersResponse = await apiRequest(
        "GET",
        `organizations/${queryParams.id}/users`
      );
      organizationRecord.users = await organizationUsersResponse.json();
      const organizationStudiesResponse = await apiRequest(
        "GET",
        `organizations/${queryParams.id}/studies`
      );
      organizationRecord.studies = await organizationStudiesResponse.json();
    }
  }

  Handlebars.registerPartial(
    "recursiveOrganizationTree",
    document.getElementById("t-recursiveOrganizationTree").innerHTML
  );

  Handlebars.registerPartial(
    "crudButton",
    document.getElementById("t-crudButton").innerHTML
  );

  const renderParams = {
    ...queryParams,
    topLevelOrganizationsSelect: topLevelOrganizationsSelect,
    children: organizationTreeChildren,
    organizationRecord: organizationRecord,
  };

  return content(renderParams);
}

async function createOrganization(partOf) {
  const organizationName =
    document.getElementById("organizationName").value || null;
  const organizationType = document.getElementById("organizationType").value;
  const organizationRecord = {
    name: organizationName,
    type: organizationType,
    partOf: partOf,
  };
  console.log(`organizationRecord: ${JSON.stringify(organizationRecord)}`);
  const response = await apiRequest(
    "POST",
    "organizations",
    organizationRecord
  );
  if (response.ok) navReturnFromCrud();
}

async function updateOrganization(id) {
  const organizationName =
    document.getElementById("organizationName").value || null;
  const organizationType = document.getElementById("organizationType").value;
  const organizationRecord = {
    name: organizationName,
    type: organizationType,
  };
  console.log(`organizationRecord: ${JSON.stringify(organizationRecord)}`);
  const response = await apiRequest(
    "PATCH",
    `organizations/${id}`,
    organizationRecord
  );
  if (response.ok) navReturnFromCrud();
}

async function deleteOrganization(id) {
  const response = await apiRequest("DELETE", `organizations/${id}`);
  if (response.ok) navReturnFromCrud();
}

async function addUserToOrganization(userEmail, organizationId) {
  if (!userEmail || !organizationId) return;
  const userRecordResponse = await apiRequest("GET", "users", {
    email: userEmail,
  });
  const userRecordPaginated = await userRecordResponse.json();
  if (userRecordPaginated.results.length == 0) {
    alert("No User with this E-mail exists.");
    return;
  }
  const response = await apiRequest(
    "POST",
    `organizations/${organizationId}/user`,
    {
      jheUserId: userRecordPaginated.results[0].id,
    }
  );
  if (response.ok) navReload();
}

async function removeUserFromOrganization(userId, organizationId) {
  if (!userId || !organizationId) return;
  const response = await apiRequest(
    "DELETE",
    `organizations/${organizationId}/user`,
    {
      jheUserId: userId,
    }
  );
  if (response.ok) navReload();
}

// ==================================================
// Patients
// ==================================================

async function renderPatients(queryParams) {
  console.log(`queryParams: ${JSON.stringify(queryParams)}`);

  const organizationsResponse = await apiRequest("GET", "users/organizations");
  const organizations = await organizationsResponse.json();

  if (organizations.length == 0) {
    alert("This user does not belong to any Organization.");
    return;
  }

  if (!queryParams.organizationId && organizations[0]) {
    nav("patients", { organizationId: organizations[0].id });
    return;
  }

  const organizationForPatientsSelect = organizations.map((organization) => {
    organization.selected =
      organization.id === parseInt(queryParams.organizationId);
    return organization;
  });

  const studiesResponse = await apiRequest("GET", "studies", {
    organizationId: queryParams.organizationId,
  });
  const studies = await studiesResponse.json();

  const studyForPatientsSelect = studies.results.map((study) => {
    study.selected = study.id === parseInt(queryParams.studyId);
    return study;
  });

  const content = Handlebars.compile(
    document.getElementById("t-patients").innerHTML
  );

  let patientsPaginated, patientRecord, studiesPendingConsent, studiesConsented;

  const patientsParams = {
    organizationId: queryParams.organizationId,
  };

  if (queryParams.studyId) {
    patientsParams["studyId"] = queryParams.studyId;
  }

  const patientsResponse = await apiRequest("GET", "patients", patientsParams);
  patientsPaginated = await patientsResponse.json();

  if (queryParams.read || queryParams.update || queryParams.delete) {

    const patientRecordResponse = await apiRequest(
      "GET",
      `patients/${queryParams.id}`
    );
    patientRecord = await patientRecordResponse.json();

    if (queryParams.read) {
      const patientRecordConsentsResponse = await apiRequest(
        "GET",
        `patients/${queryParams.id}/consents`
      );
      patientRecordConsents = await patientRecordConsentsResponse.json();
      studiesPendingConsent = patientRecordConsents.studiesPendingConsent
      studiesConsented = patientRecordConsents.studies;
      console.log(JSON.stringify(patientRecordConsents));
    }
  }

  Handlebars.registerPartial(
    "crudButton",
    document.getElementById("t-crudButton").innerHTML
  );

  const renderParams = {
    ...queryParams,
    patients: patientsPaginated?.results,
    patientRecord: patientRecord,
    organizationForPatientsSelect: organizationForPatientsSelect,
    studyForPatientsSelect: studyForPatientsSelect,
    studiesPendingConsent: studiesPendingConsent,
    studiesConsented: studiesConsented,
  };

  return content(renderParams);
}

async function createPatient(organizationId) {
  const patientRecord = {
    organizationId: organizationId,
    identifier:
      document.getElementById("patientIdentifier").value ||
      Math.random().toString().split(".")[1], // temporarily create one until we have form validation
    nameFamily: document.getElementById("patientFamilyName").value || null,
    nameGiven: document.getElementById("patientGivenName").value || null,
    birthDate: document.getElementById("patientBirthDate").value || null,
    telecomEmail: document.getElementById("patientTelecomEmail").value || null,
    telecomPhone: document.getElementById("patientTelecomPhone").value || null,
  };
  const response = await apiRequest("POST", `patients`, patientRecord);
  if (response.ok) navReturnFromCrud();
}

async function updatePatient(id) {
  const patientRecord = {
    identifier: document.getElementById("patientIdentifier").value || null,
    nameFamily: document.getElementById("patientFamilyName").value || null,
    nameGiven: document.getElementById("patientGivenName").value || null,
    birthDate: document.getElementById("patientBirthDate").value || null,
    telecomPhone: document.getElementById("patientTelecomPhone").value || null,
  };
  const response = await apiRequest("PATCH", `patients/${id}`, patientRecord);
  if (response.ok) navReturnFromCrud();
}

async function deletePatient(id) {
  if (await apiRequest("DELETE", `patients/${id}`)) navReturnFromCrud();
}

async function getInvitationLink(id) {
  const invitationLinkResponse = await apiRequest(
    "GET",
    `patients/${id}/invitation_link`
  );
  const invitationLink = await invitationLinkResponse.json();
  document.getElementById("invitationLink").value =
    invitationLink["invitationLink"];
  document.getElementById("copyInvitationLink").disabled = false;
}

// ==================================================
// Studies
// ==================================================

async function renderStudies(queryParams) {
  console.log(`queryParams: ${JSON.stringify(queryParams)}`);

  const content = Handlebars.compile(
    document.getElementById("t-studies").innerHTML
  );

  const organizationsResponse = await apiRequest("GET", "users/organizations");
  const organizations = await organizationsResponse.json();

  if(organizations.length==0){
    alert('This user does not belong to any Organization.')
    return
  }

  if (!queryParams.organizationId && organizations[0]) {
    nav("studies", { organizationId: organizations[0].id });
    return;
  }

  const organizationForStudiesSelect = organizations.map((organization) => {
    organization.selected =
      organization.id === parseInt(queryParams.organizationId);
    return organization;
  });

  const studiesResponse = await apiRequest("GET", "studies", {
    organizationId: queryParams.organizationId,
  });

  const studiesPaginated = await studiesResponse.json();

  let studyRecord, allDataSources, allScopes;

  if (queryParams.create) {
    studyRecord = {
      organization: {
        id: queryParams.organizationId,
        name: queryParams.organizationName,
      },
    };
  } else if (queryParams.read || queryParams.update || queryParams.delete) {
    const studyRecordResponse = await apiRequest(
      "GET",
      `studies/${queryParams.id}`
    );
    studyRecord = await studyRecordResponse.json();

    if (queryParams.read) {
      const studyDataSourcesResponse = await apiRequest(
        "GET",
        `studies/${queryParams.id}/data_sources`
      );
      studyRecord.dataSources = await studyDataSourcesResponse.json();

      const allDataSourcesResponse = await apiRequest("GET", `data_sources`);
      allDataSources = await allDataSourcesResponse.json();

      // filter out the data sources that have already been added
      const dataSourceIds = studyRecord.dataSources.map((s) => s.id);
      allDataSources.results = allDataSources.results.filter(
        (dataSource) => dataSourceIds.indexOf(dataSource.id) == -1
      );

      console.log(studyRecord.dataSources);

      const studyScopesRequestedResponse = await apiRequest(
        "GET",
        `studies/${queryParams.id}/scope_requests`
      );
      studyRecord.scopesRequested = await studyScopesRequestedResponse.json();

      const allScopesResponse = await apiRequest(
        "GET",
        `data_sources/all_scopes`
      );
      allScopes = await allScopesResponse.json();

      // filter out the scopes that have already been requested
      const scopesRequestedIds = studyRecord.scopesRequested.map(
        (s) => s.scopeCode.id
      );
      allScopes = allScopes.filter(
        (scope) => scopesRequestedIds.indexOf(scope.id) == -1
      );
    }
  }

  Handlebars.registerPartial(
    "crudButton",
    document.getElementById("t-crudButton").innerHTML
  );

  const renderParams = {
    ...queryParams,
    studies: studiesPaginated?.results,
    studyRecord: studyRecord,
    allScopes: allScopes ? allScopes : null,
    allDataSources: allDataSources?.results ? allDataSources.results : null,
    patientCount: store.addPatientIdsToStudy
      ? store.addPatientIdsToStudy.length
      : null,
    organizationForStudiesSelect: organizationForStudiesSelect,
  };

  return content(renderParams);
}

async function createStudyFromOrganization(organizationId, organizationName) {
  if (crudModal._isShown) crudModal.hide();
  nav("studies", {
    create: true,
    organizationId: organizationId,
    organizationName: organizationName,
  });
}

async function createStudy() {
  const studyRecord = {
    name: document.getElementById("studyName").value || null,
    description: document.getElementById("studyDescription").value || null,
    organization: parseInt(
      document.getElementById("studyOrganizationId").value
    ),
  };
  const response = await apiRequest("POST", `studies`, studyRecord);
  if (response.ok) navReturnFromCrud();
}

async function updateStudy(id) {
  const studyRecord = {
    name: document.getElementById("studyName").value || null,
    description: document.getElementById("studyDescription").value || null,
  };
  const response = await apiRequest("PATCH", `studies/${id}`, studyRecord);
  if (response.ok) navReturnFromCrud();
}

function getSelectedRecordIds(selector) {
  const selected = [];
  document.querySelectorAll(selector).forEach((checkbox) => {
    if (checkbox.checked) {
      selected.push(parseInt(checkbox.value));
    }
  });
  return selected;
}

async function selectPatientsForStudy(organizationId) {
  const selectedRecordIds = getSelectedRecordIds(".patient-checkbox");
  if (selectedRecordIds.length == 0) {
    alert("Please select one or more Patients to add to the Study.");
    return;
  }
  delete store.addPatientIdsToStudy;
  store.addPatientIdsToStudy = selectedRecordIds;
  nav("studies", { organizationId: organizationId, addPatients: true });
}

async function addPatientsToStudy(studyId, organizationId) {
  const patientUserIdsRecord = {
    patientIds: store.addPatientIdsToStudy,
  };
  const response = await apiRequest(
    "POST",
    `studies/${studyId}/patients`,
    patientUserIdsRecord
  );
  if (response.ok)
    nav("patients", { studyId: studyId, organizationId: organizationId });
}

async function removeSelectedPatientsFromStudy(studyId) {
  const selectedRecordIds = getSelectedRecordIds(".patient-checkbox");
  if (selectedRecordIds.length == 0) {
    alert(`Please select one or more Patients to remove from Study ${studyId}`);
    return;
  }
  removePatientsFromStudy(selectedRecordIds, studyId);
}

async function removePatientsFromStudy(patientIds, studyId) {
  if (!patientIds || !studyId) return;
  const response = await apiRequest("DELETE", `studies/${studyId}/patients`, {
    patientIds: patientIds,
  });
  if (response.ok) navReload();
}

async function addScopeRequestToStudy(scopeCodeId, studyId) {
  if (!scopeCodeId || !studyId) return;
  const response = await apiRequest(
    "POST",
    `studies/${studyId}/scope_requests`,
    {
      scopeCodeId: scopeCodeId,
    }
  );
  if (response.ok) navReload();
}

async function removeScopeRequestFromStudy(scopeCodeId, studyId) {
  if (!scopeCodeId || !studyId) return;
  const response = await apiRequest(
    "DELETE",
    `studies/${studyId}/scope_requests`,
    {
      scopeCodeId: scopeCodeId,
    }
  );
  if (response.ok) navReload();
}

async function addDataSourceToStudy(dataSourceId, studyId) {
  if (!dataSourceId || !studyId) return;
  const response = await apiRequest("POST", `studies/${studyId}/data_sources`, {
    dataSourceId: dataSourceId,
  });
  if (response.ok) navReload();
}

async function removeDataSourceFromStudy(dataSourceId, studyId) {
  if (!dataSourceId || !studyId) return;
  const response = await apiRequest(
    "DELETE",
    `studies/${studyId}/data_sources`,
    {
      dataSourceId: dataSourceId,
    }
  );
  if (response.ok) navReload();
}

async function deleteStudy(id) {
  response = await apiRequest("DELETE", `studies/${id}`);
  if (response.ok) navReturnFromCrud();
}

// ==================================================
// Observations
// ==================================================

async function renderObservations(queryParams) {
  console.log(`queryParams: ${JSON.stringify(queryParams)}`);

  const organizationsResponse = await apiRequest("GET", "users/organizations");
  const organizations = await organizationsResponse.json();

  if (organizations.length == 0) {
    alert("This user does not belong to any Organization.");
    return;
  }

  if (!queryParams.organizationId && organizations[0]) {
    nav("observations", { organizationId: organizations[0].id });
    return;
  }

  const organizationForObservationsSelect = organizations.map(
    (organization) => {
      organization.selected =
        organization.id === parseInt(queryParams.organizationId);
      return organization;
    }
  );

  const studiesResponse = await apiRequest("GET", "studies", {
    organizationId: queryParams.organizationId,
  });
  const studies = await studiesResponse.json();

  const studyForObservationsSelect = studies.results.map((study) => {
    study.selected = study.id === parseInt(queryParams.studyId);
    return study;
  });

  const content = Handlebars.compile(
    document.getElementById("t-observations").innerHTML
  );

  const observationParams = {
    organizationId: queryParams.organizationId,
  };

  if (queryParams.studyId) {
    observationParams["studyId"] = queryParams.studyId;
  }

  const observationsResponse = await apiRequest(
    "GET",
    "observations",
    observationParams
  );

  const observationsPaginated = await observationsResponse.json();

  observationsPaginated.results = observationsPaginated.results.map(
    (observation) => {
      observation.valueAttachmentData = JSON.stringify(
        observation.valueAttachmentData,
        null,
        2
      );
      return observation;
    }
  );

  let observationRecord;

  Handlebars.registerPartial(
    "crudButton",
    document.getElementById("t-crudButton").innerHTML
  );

  const renderParams = {
    ...queryParams,
    observations: observationsPaginated.results,
    observationRecord: observationRecord,
    organizationForObservationsSelect: organizationForObservationsSelect,
    studyForObservationsSelect: studyForObservationsSelect,
  };

  return content(renderParams);
}

// ==================================================
// Data Sources
// ==================================================

async function renderDataSources(queryParams) {
  console.log(`queryParams: ${JSON.stringify(queryParams)}`);
  const content = Handlebars.compile(
    document.getElementById("t-dataSources").innerHTML
  );
  const dataSourcesResponse = await apiRequest("GET", "data_sources");
  const dataSourcesPaginated = await dataSourcesResponse.json();
  let dataSourceRecord = {};
  let allScopes;

  if (queryParams.read || queryParams.update || queryParams.delete) {
    const dataSourceRecordResponse = await apiRequest(
      "GET",
      `data_sources/${queryParams.id}`
    );
    dataSourceRecord = await dataSourceRecordResponse.json();
  }

  dataSourceRecord.typeSelect = buildSelectOptions(CONSTANTS.DATA_SOURCE_TYPES);

  if (queryParams.read) {
    const dataSourceSupportedScopesResponse = await apiRequest(
      "GET",
      `data_sources/${queryParams.id}/supported_scopes`
    );
    dataSourceRecord.supportedScopes =
      await dataSourceSupportedScopesResponse.json();

    const allScopesResponse = await apiRequest(
      "GET",
      `data_sources/all_scopes`
    );
    allScopes = await allScopesResponse.json();

    // filter out the scopes that have already been requested
    const scopesSupportedIds = dataSourceRecord.supportedScopes.map(
      (s) => s.scopeCode.id
    );
    allScopes = allScopes.filter(
      (scope) => scopesSupportedIds.indexOf(scope.id) == -1
    );
  }

  Handlebars.registerPartial(
    "crudButton",
    document.getElementById("t-crudButton").innerHTML
  );

  const renderParams = {
    ...queryParams,
    dataSources: dataSourcesPaginated.results,
    dataSourceRecord: dataSourceRecord,
    allScopes: allScopes,
  };

  return content(renderParams);
}

async function createDataSource() {
  const dataSourceRecord = {
    name: document.getElementById("dataSourceName").value || null,
    type: document.getElementById("dataSourceType").value,
  };
  if (await apiRequest("POST", `data_sources`, dataSourceRecord))
    navReturnFromCrud();
}

async function deleteDataSource(id) {
  if (await apiRequest("DELETE", `data_sources/${id}`)) navReturnFromCrud();
}

async function addScopeToDataSource(scopeCodeId, dataSourceId) {
  if (!scopeCodeId || !dataSourceId) return;
  const response = await apiRequest(
    "POST",
    `data_sources/${dataSourceId}/supported_scopes`,
    {
      scopeCodeId: scopeCodeId,
    }
  );
  if (response.ok) navReload();
}

async function removeScopeFromDataSource(scopeCodeId, dataSourceId) {
  if (!scopeCodeId || !dataSourceId) return;
  const response = await apiRequest(
    "DELETE",
    `data_sources/${dataSourceId}/supported_scopes`,
    {
      scopeCodeId: scopeCodeId,
    }
  );
  if (response.ok) navReload();
}

// ==================================================
// Dev and Debug
// ==================================================

// add an event listener to the window that watches for url changes
// window.onpopstate = locationHandler;
// call the urlLocationHandler function to handle the initial url
// window.route = route;
// call the urlLocationHandler function to handle the initial url
// locationHandler();

function debugGetUser() {
  userManager
    .getUser()
    .then((user) => {
      document.getElementById("debugAuthOut").innerHTML =
        "userManager: " + JSON.stringify(user, null, 2);
    })
    .catch((err) => {
      console.error(err);
    });
}

function debugRemoveUser() {
  userManager
    .removeUser()
    .then(() => {
      document.getElementById("debugAuthOut").innerHTML =
        "userManager: user removed";
    })
    .catch((err) => {
      console.error(err);
    });
}

function debugRedirectSignin() {
  userManager
    .signinRedirect()
    .then((user) => {
      document.getElementById("debugAuthOut").innerHTML =
        "userManager: " + JSON.stringify(user, null, 2);
    })
    .catch((err) => {
      console.error(err);
    });
}

let debugPatientToken;

async function debugGetPatientTokenFromCode() {
  const formData = new URLSearchParams(
    JSON.parse(document.getElementById("debugOAuthPayload").value)
  ).toString();
  const response = await fetch("/o/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: formData,
  });
  const tokens = await response.json();
  setDebugPatientToken(tokens?.access_token);
  document.getElementById("debugPatientTokenOut").innerHTML = JSON.stringify(
    tokens,
    null,
    2
  );
}

function setDebugPatientToken(accessToken) {
  if (accessToken) {
    debugPatientToken = accessToken;
    document.getElementById(
      "debugPatientToken"
    ).innerHTML = `Client Token: ${debugPatientToken}`;
  } else {
    document.getElementById(
      "debugPatientToken"
    ).innerHTML = `Client Token: None`;
  }
}

async function debugGetUserProfile() {
  const response = await fetch("/api/v1/users/profile", {
    headers: {
      "Cache-Control": "no-cache",
      Authorization: `Bearer ${debugPatientToken}`,
    },
  });
  const out = await response.json();
  document.getElementById("debugUserProfileOut").innerHTML = JSON.stringify(
    out,
    null,
    2
  );
}

async function debugGetPendingPatientConsents() {
  const response = await fetch(
    document.getElementById("debugPendingPatientConsentsUrl").value,
    {
      headers: {
        "Cache-Control": "no-cache",
        Authorization: `Bearer ${debugPatientToken}`,
      },
    }
  );
  const out = await response.json();
  document.getElementById("debugPendingPatientConsentsOut").innerHTML =
    JSON.stringify(out, null, 2);
}

async function debugDoPatientConsents() {
  const method = document.getElementById("debugPatientConsentsMethod").value;
  const headers = {
    "Cache-Control": "no-cache",
    Authorization: `Bearer ${debugPatientToken}`,
  };
  let body;
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = document.getElementById("debugPatientConsentsPayload").value;
  }
  const response = await fetch(
    document.getElementById("debugPatientConsentsUrl").value,
    {
      method: method,
      headers: headers,
      body: body,
    }
  );
  const out = await response.json();
  document.getElementById("debugPatientConsentsOut").innerHTML = JSON.stringify(
    out,
    null,
    2
  );
}

async function debugDoObservations() {
  const method = document.getElementById("debugObservationsMethod").value;
  const headers = {
    "Cache-Control": "no-cache",
  };
  let body;
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = document.getElementById("debugObservationsPayload").value;
  }
  const response = await fetch(
    document.getElementById("debugObservationsUrl").value,
    {
      method: method,
      headers: headers,
      body: body,
    }
  );
  const out = await response.json();
  document.getElementById("debugObservationsOut").innerHTML = JSON.stringify(
    out,
    null,
    2
  );
}
