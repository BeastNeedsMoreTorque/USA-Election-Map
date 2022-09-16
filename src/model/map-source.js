class MapSource
{
  constructor(id, name, dataURL, homepageURL, iconURL, columnMap, cycleYear, candidateNameToPartyIDMap, shortCandidateNameOverride, regionNameToIDMap, regionIDToLinkMap, heldRegionMap, shouldFilterOutDuplicateRows, addDecimalPadding, organizeMapDataFunction, viewingDataFunction, zoomingDataFunction, splitVoteDataFunction, splitVoteDisplayOptions, getFormattedRegionName, customOpenRegionLinkFunction, updateCustomMapFunction, convertMapDataRowToCSVFunction, isCustomMap, shouldClearDisabled, shouldShowVoteshare, voteshareCutoffMargin, overrideSVGPath, shouldSetDisabledWorthToZero, shouldUseOriginalMapDataForTotalsPieChart, shouldForcePopularVoteDisplayOnZoom)
  {
    this.id = id
    this.name = name
    this.dataURL = dataURL
    this.homepageURL = homepageURL
    this.iconURL = iconURL
    this.columnMap = columnMap
    this.cycleYear = cycleYear
    this.candidateNameToPartyIDMap = candidateNameToPartyIDMap && this.cycleYear ? candidateNameToPartyIDMap[this.cycleYear] : candidateNameToPartyIDMap
    this.shortCandidateNameOverride = shortCandidateNameOverride && this.cycleYear ? shortCandidateNameOverride[this.cycleYear] : shortCandidateNameOverride
    this.regionNameToIDMap = regionNameToIDMap
    this.regionIDToLinkMap = regionIDToLinkMap
    this.heldRegionMap = heldRegionMap
    this.shouldFilterOutDuplicateRows = shouldFilterOutDuplicateRows
    this.addDecimalPadding = addDecimalPadding
    this.filterMapDataFunction = organizeMapDataFunction
    this.viewingDataFunction = viewingDataFunction || ((mapData) => {
      return mapData
    })
    this.zoomingDataFunction = zoomingDataFunction
    this.splitVoteDataFunction = splitVoteDataFunction || ((mapData) => {
      return mapData
    })
    this.splitVoteDisplayOptions = splitVoteDisplayOptions
    this.getFormattedRegionName = getFormattedRegionName
    this.customOpenRegionLinkFunction = customOpenRegionLinkFunction
    this.updateCustomMapFunction = updateCustomMapFunction
    this.convertMapDataRowToCSVFunction = convertMapDataRowToCSVFunction
    this.isCustomMap = isCustomMap == null ? false : isCustomMap
    this.shouldClearDisabled = shouldClearDisabled == null ? true : shouldClearDisabled
    this.shouldShowVoteshare = shouldShowVoteshare == null ? false : shouldShowVoteshare
    this.voteshareCutoffMargin = voteshareCutoffMargin
    this.overrideSVGPath = overrideSVGPath
    this.shouldSetDisabledWorthToZero = shouldSetDisabledWorthToZero == null ? false : true
    this.shouldUseOriginalMapDataForTotalsPieChart = shouldUseOriginalMapDataForTotalsPieChart == null ? false : shouldUseOriginalMapDataForTotalsPieChart
    this.shouldForcePopularVoteDisplayOnZoom = shouldForcePopularVoteDisplayOnZoom == null ? false : shouldForcePopularVoteDisplayOnZoom
  }

  // id,
  // name,
  // dataURL,
  // homepageURL,
  // iconURL,
  // columnMap,
  // cycleYear,
  // candidateNameToPartyIDMap,
  // shortCandidateNameOverride,
  // regionNameToIDMap,
  // regionIDToLinkMap,
  // heldRegionMap,
  // shouldFilterOutDuplicateRows,
  // addDecimalPadding,
  // organizeMapDataFunction,
  // viewingDataFunction,
  // zoomingDataFunction,
  // splitVoteDataFunction,
  // splitVoteDisplayOptions,
  // getFormattedRegionName,
  // customOpenRegionLinkFunction,
  // updateCustomMapFunction,
  // convertMapDataRowToCSVFunction,
  // isCustomMap,
  // shouldClearDisabled,
  // shouldShowVoteshare,
  // voteshareCutoffMargin,
  // overrideSVGPath,
  // shouldSetDisabledWorthToZero
  // shouldUseOriginalMapDataForTotalsPieChart
  // shouldForcePopularVoteDisplayOnZoom

  loadMap(reloadCache, onlyAttemptLocalFetch, resetCandidateNames)
  {
    var self = this

    var loadMapPromise = new Promise(async (resolve) => {
      reloadCache = reloadCache ? true : (self.dataURL ? !(await CSVDatabase.isSourceUpdated(self.id)) : false)
      resetCandidateNames = resetCandidateNames != null ? resetCandidateNames : true

      if ((self.rawMapData == null || reloadCache) && (self.dataURL || self.textMapData))
      {
        var textData
        if (self.dataURL)
        {
          textData = await self.loadMapCache(self, reloadCache, onlyAttemptLocalFetch)
        }
        else
        {
          textData = self.textMapData
        }
        if (textData == null) { resolve(false); return }
        self.rawMapData = self.convertCSVToArray(self, textData)
      }

      if (self.rawMapData == null) { resolve(false); return }

      self.mapDates = Object.keys(self.rawMapData)
      for (var dateNum in self.mapDates)
      {
        self.mapDates[dateNum] = parseInt(self.mapDates[dateNum])
      }
      self.mapDates.sort((mapDate1, mapDate2) => (mapDate1-mapDate2))

      self.setDateRange(self)

      var filterMapDataCallback = self.filterMapDataFunction(self.rawMapData, self.mapDates, self.columnMap, self.cycleYear, self.candidateNameToPartyIDMap, self.regionNameToIDMap, self.heldRegionMap, self.shouldFilterOutDuplicateRows, self.isCustomMap, self.voteshareCutoffMargin, !self.isCustomMap || self.editingMode == EditingMode.voteshare)
      self.mapData = filterMapDataCallback.mapData

      if (filterMapDataCallback.candidateNameData != null && resetCandidateNames)
      {
        if (self.candidateNameData != null)
        {
          for (var date in filterMapDataCallback.candidateNameData)
          {
            self.candidateNameData[date] = mergeObject(self.candidateNameData[date], filterMapDataCallback.candidateNameData[date])
          }
        }
        else
        {
          self.candidateNameData = filterMapDataCallback.candidateNameData
        }
      }
      for (var date in self.candidateNameData)
      {
        if (self.candidateNameData[date] == null) { continue }
        if (Object.keys(self.candidateNameData[date]).length == 0)
        {
          self.candidateNameData[date] = cloneObject(self.shortCandidateNameOverride)
        }
      }

      if (filterMapDataCallback.mapDates != null)
      {
        self.mapDates = filterMapDataCallback.mapDates
      }

      resolve(true)
    })

    return loadMapPromise
  }

  loadMapCache(self, reloadCache, onlyAttemptLocalFetch)
  {
    self = self || this

    var fetchMapDataPromise = new Promise(async (resolve) => {
      if (!reloadCache)
      {
        var savedCSVText = await CSVDatabase.fetchFile(this.id)
        if (savedCSVText != null)
        {
          return resolve(savedCSVText)
        }
        else if (onlyAttemptLocalFetch)
        {
          return resolve()
        }
      }

      $("#loader").show()
      $.get(self.dataURL, null, function(data) {
        $("#loader").hide()

        CSVDatabase.insertFile(self.id, data)
        resolve(data)
      }, "text").fail(function() {
        $("#loader").hide()

        resolve(null)
      })
    })

    return fetchMapDataPromise
  }

  convertCSVToArray(self, strData)
  {
    let finalArray = {}

    const columnDelimiter = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/
    const rowDelimiter = "\n"

    let rowSplitStringArray = strData.split(rowDelimiter)
    let fieldKeys = []
    for (let rowNum in rowSplitStringArray)
    {
      if (rowSplitStringArray[rowNum] == "") { continue }

      let rowDataArray = {}
      let columnSplitStringArray = rowSplitStringArray[rowNum].split(columnDelimiter)
      for (let columnNum in columnSplitStringArray)
      {
        if (columnSplitStringArray[columnNum] != null)
        {
          columnSplitStringArray[columnNum] = columnSplitStringArray[columnNum].replace("\r", "").replaceAll('\"', "")
        }
        if (rowNum == 0)
        {
          fieldKeys.push(columnSplitStringArray[columnNum])
        }
        else
        {
          rowDataArray[fieldKeys[columnNum]] = columnSplitStringArray[columnNum]
        }
      }

      if (rowNum > 0)
      {
        let rowModelDate = new Date(rowDataArray[self.columnMap.date])
        if (!finalArray[rowModelDate.getTime()])
        {
          finalArray[rowModelDate.getTime()] = []
        }
        finalArray[rowModelDate.getTime()].push(rowDataArray)
      }
    }

    return finalArray
  }

  setTextMapData(textData, self)
  {
    self = self || this
    this.textMapData = textData
  }

  getTextMapData()
  {
    return this.textMapData
  }

  getMapData()
  {
    return this.mapData
  }

  resetMapData()
  {
    this.rawMapData = null
    this.mapData = null
    this.mapDates = null
    this.startDate = null
    this.endDate = null
  }

  clearMapData(shouldFullClear)
  {
    shouldFullClear = shouldFullClear == null ? false : shouldFullClear

    var mapIsClearExceptDisabled = true

    for (var mapDate in this.mapData)
    {
      for (var regionID in this.mapData[mapDate])
      {
        if (!this.mapData[mapDate][regionID].disabled && this.mapData[mapDate][regionID].partyID != tossupPartyID)
        {
          this.mapData[mapDate][regionID].partyID = tossupPartyID
          this.mapData[mapDate][regionID].margin = 0
          this.mapData[mapDate][regionID].partyVotesharePercentages = []

          mapIsClearExceptDisabled = false
        }
      }
    }

    this.textMapData = this.convertArrayToCSV(this.mapData, this.columnMap, this.regionNameToIDMap, this.candidateNameToPartyIDMap, this.convertMapDataRowToCSVFunction)
    this.rawMapData = this.convertCSVToArray(this, this.textMapData)

    if (this.shouldClearDisabled || mapIsClearExceptDisabled || shouldFullClear)
    {
      this.setTextMapData("date\n" + getTodayString("/", false, "mdy"), this)
      this.setIconURL("", this)
      if (this.candidateNameData != null)
      {
        for (var date in this.candidateNameData)
        {
          this.candidateNameData[date] = cloneObject(this.shortCandidateNameOverride)
        }
      }
      dropdownPoliticalPartyIDs = cloneObject(defaultDropdownPoliticalPartyIDs)

      overrideRegionEVs = {}
    }
  }

  setDateRange(self)
  {
    self.startDate = new Date(self.mapDates[0])
    self.endDate = new Date(self.mapDates[self.mapDates.length-1])
  }

  getDateRange()
  {
    return {start: this.startDate, end: this.endDate}
  }

  getMapDates()
  {
    return this.mapDates
  }

  getRegionData(modelDate, regionID)
  {
    return this.mapData[modelDate][regionID]
  }

  getViewingData(mapDateData)
  {
    return this.viewingDataFunction(mapDateData)
  }

  getZoomingData(mapDateData, zoomRegion)
  {
    return this.zoomingDataFunction(mapDateData, zoomRegion)
  }

  getSplitVoteData(mapDateData)
  {
    return this.splitVoteDataFunction(mapDateData)
  }

  async canZoom(mapDateData)
  {
    return this.zoomingDataFunction != null && (!mapDateData || await this.zoomingDataFunction(mapDateData, null, true) != null)
  }

  getSplitVoteDisplayOptions()
  {
    return this.splitVoteDisplayOptions
  }

  openRegionLink(regionID, modelDate)
  {
    if (this.customOpenRegionLinkFunction == undefined)
    {
      if (!this.homepageURL) { return }
      window.open(this.homepageURL + this.regionIDToLinkMap[regionID])
    }
    else
    {
      this.customOpenRegionLinkFunction(this.homepageURL, regionID, this.regionIDToLinkMap, modelDate, false, this.mapData)
    }
  }

  openHomepageLink(modelDate)
  {
    if (this.customOpenRegionLinkFunction == undefined)
    {
      if (!this.homepageURL) { return }
      window.open(this.homepageURL)
    }
    else
    {
      this.customOpenRegionLinkFunction(this.homepageURL, null, null, modelDate, true, this.mapData)
    }
  }

  getID()
  {
    return this.id
  }

  getName()
  {
    return this.name
  }

  getCandidateNames(date)
  {
    if (this.candidateNameData == null || date == null || this.candidateNameData[date] == null || JSON.stringify(this.candidateNameData[date]) == "{}")
    {
      return this.shortCandidateNameOverride
    }
    else
    {
      return this.candidateNameData[date]
    }
  }

  setCandidateNames(candidateNamesToSet, dateToSet, self)
  {
    self = self || this

    if (self.candidateNameData == null) { self.candidateNameData = {} }
    self.candidateNameData[dateToSet] = cloneObject(candidateNamesToSet)
  }

  getIconURL(shouldGetSmall)
  {
    if (!this.iconURL) { return null }

    if (!shouldGetSmall && this.iconURL.regular)
    {
      return this.iconURL.regular
    }
    if (shouldGetSmall && this.iconURL.mini)
    {
      return this.iconURL.mini
    }
    return this.iconURL
  }

  setIconURL(newIconURL, self)
  {
    self = self || this
    this.iconURL = newIconURL
  }

  hasHomepageURL()
  {
    return this.homepageURL != null
  }

  getAddDecimalPadding()
  {
    return this.addDecimalPadding
  }

  isCustom()
  {
    return this.isCustomMap
  }

  getShouldShowVoteshare()
  {
    return this.editingMode == EditingMode.voteshare || this.shouldShowVoteshare
  }

  getOverrideSVGPath(mapDate)
  {
    var isFunction = (typeof this.overrideSVGPath === 'function')
    if (this.mapData == null) return isFunction ? null : this.overrideSVGPath

    var mapDates = Object.keys(this.mapData)
    var mapDateToUse = mapDate || mapDates[mapDates.length-1]
    return isFunction ? this.overrideSVGPath(mapDateToUse) : this.overrideSVGPath
  }

  getShouldSetDisabledWorthToZero()
  {
    return this.shouldSetDisabledWorthToZero
  }

  getShouldUseOriginalMapDataForTotalsPieChart()
  {
    return this.shouldUseOriginalMapDataForTotalsPieChart && !(currentViewingState == ViewingState.zooming && currentMapType.getMapSettingValue("zoomSeatTotals"))
  }

  getShouldForcePopularVoteDisplayOnZoom()
  {
    return this.shouldForcePopularVoteDisplayOnZoom
  }

  getDropdownPartyIDs()
  {
    return this.dropdownPartyIDs
  }

  setDropdownPartyIDs(partyIDs)
  {
    var dropdownPartyIDs = cloneObject(partyIDs)
    if (dropdownPartyIDs.includes(addButtonPartyID))
    {
      dropdownPartyIDs.splice(dropdownPartyIDs.indexOf(addButtonPartyID), 1)
    }
    this.dropdownPartyIDs = dropdownPartyIDs
  }

  updateMapData(displayRegionArray, dateToUpdate, resetMapData, candidateNames, editingMode)
  {
    this.editingMode = editingMode ?? this.editingMode ?? EditingMode.margin

    if (!this.mapData || resetMapData)
    {
      this.mapData = {}
    }
    if (!(dateToUpdate in this.mapData))
    {
      this.mapData[dateToUpdate] = {}
    }

    if (this.updateCustomMapFunction)
    {
      this.updateCustomMapFunction(displayRegionArray, this.mapData[dateToUpdate])
    }
    else
    {
      for (let regionID in displayRegionArray)
      {
        if (regionID.endsWith(subregionSeparator + statePopularVoteDistrictID)) { continue }

        let regionData = displayRegionArray[regionID]
        regionData.region = regionID

        this.mapData[dateToUpdate][regionID] = cloneObject(regionData)
      }
    }

    if (candidateNames)
    {
      this.candidateNameToPartyIDMap = invertObject(candidateNames)
    }
    this.textMapData = this.convertArrayToCSV(this.mapData, this.columnMap, this.regionNameToIDMap, this.candidateNameToPartyIDMap, this.convertMapDataRowToCSVFunction)
    this.rawMapData = this.convertCSVToArray(this, this.textMapData)
  }

  convertArrayToCSV(mapData, columnMap, regionNameToID, candidateNameToPartyIDs, convertMapDataRowToCSVFunction)
  {
    let csvText = ""

    let columnTitles = Object.values(columnMap)
    for (let titleNum in columnTitles)
    {
      csvText += columnTitles[titleNum]
      if (titleNum < columnTitles.length-1)
      {
        csvText += ","
      }
    }
    csvText += "\n"

    for (let mapDate in mapData)
    {
      let mapDateObject = new Date(parseInt(mapDate))
      let mapDateString = (mapDateObject.getMonth()+1) + "/" + mapDateObject.getDate() + "/" + mapDateObject.getFullYear()
      for (let regionID in mapData[mapDate])
      {
        let regionData = mapData[mapDate][regionID]

        let candidatesToAdd = regionData.partyVotesharePercentages && this.editingMode == EditingMode.voteshare ? regionData.partyVotesharePercentages.reduce((candidateMap, partyPercentage) =>
        {
          return {...candidateMap, [partyPercentage.candidate]: partyPercentage.partyID}
        }, {}) : cloneObject(candidateNameToPartyIDs)

        if (regionData.partyID && regionData.partyID != TossupParty.getID() && !getKeyByValue(candidatesToAdd, regionData.partyID))
        {
          candidatesToAdd[regionData.candidateName || politicalParties[regionData.partyID].getNames()[0]] = regionData.partyID
        }

        if (regionData.margin == 0 && regionData.partyID == TossupParty.getID())
        {
          candidatesToAdd[IndependentGenericParty.getNames()[0]] = IndependentGenericParty.getID()
        }

        for (let candidateName in candidatesToAdd)
        {
          if (candidatesToAdd[candidateName] != regionData.partyID && regionData.margin != 0 && !regionData.partyVotesharePercentages) { continue }

          for (let columnTitleNum in columnTitles)
          {
            let columnKey = getKeyByValue(columnMap, columnTitles[columnTitleNum])
            csvText += convertMapDataRowToCSVFunction(columnKey, mapDateString, regionID, regionNameToID, candidateName, candidatesToAdd[candidateName], regionData, this.editingMode == EditingMode.voteshare)

            if (columnTitleNum < columnTitles.length-1)
            {
              csvText += ","
            }
          }

          csvText += "\n"
        }
      }
    }

    csvText = csvText.slice(0, -1)

    var rowCount = csvText.split("\n").length
    if (rowCount == 1)
    {
      var mapDates = []
      if (mapData)
      {
        mapDates = Object.keys(mapData)
      }
      var dateToUse = new Date()
      if (mapDates.length > 0)
      {
        dateToUse = new Date(parseInt(mapDates[0]))
      }
      csvText = "date\n" + (dateToUse.getMonth()+1) + "/" + dateToUse.getDate() + "/" + dateToUse.getFullYear()
    }

    return csvText
  }

  getEditingMode()
  {
    return this.editingMode
  }
}


// Map Source Declarations

const democraticPartyID = DemocraticParty.getID()
const republicanPartyID = RepublicanParty.getID()
const tossupPartyID = TossupParty.getID()

const whigPartyID = WhigParty.getID()
const nationalRepublicanPartyID = NationalRepublicanParty.getID()
const democraticRepublicanPartyID = DemocraticRepublicanParty.getID()
const federalistPartyID = FederalistParty.getID()

const reformPartyID = ReformParty.getID()
const greenPartyID = GreenParty.getID()
const libertarianPartyID = LibertarianParty.getID()

const freeSoilPartyID = FreeSoilParty.getID()

const independentRNPartyID = IndependentRNParty.getID()

const independent2016EMPartyID = Independent2016EMParty.getID()
const independent2016CPPartyID = Independent2016CPParty.getID()
const independent2016BSPartyID = Independent2016BSParty.getID()
const independent2016RPPartyID = Independent2016RPParty.getID()
const independent2016JKPartyID = Independent2016JKParty.getID()
const independent2016SEPartyID = Independent2016SEParty.getID()
const independent2004JEPartyID = Independent2004JEParty.getID()
const independent1988LBPartyID = Independent1988LBParty.getID()
const independent1980JAPartyID = Independent1980JAParty.getID()
const independent1976EMPartyID = Independent1976EMParty.getID()
const independent1976RRPartyID = Independent1976RRParty.getID()
const independent1968GWPartyID = Independent1968GWParty.getID()
const independent1960HBPartyID = Independent1960HBParty.getID()
const independent1956WJPartyID = Independent1956WJParty.getID()
const independent1948SMPartyID = Independent1948SMParty.getID()
const independent1948HWPartyID = Independent1948HWParty.getID()
const independent1932NTPartyID = Independent1932NTParty.getID()
const independent1924RLPartyID = Independent1924RLParty.getID()
const independent1920EDPartyID = Independent1920EDParty.getID()
const independent1916ABPartyID = Independent1916ABParty.getID()
const independent1912TRPartyID = Independent1912TRParty.getID()
const independent1912EDPartyID = Independent1912EDParty.getID()
const independent1892JWPartyID = Independent1892JWParty.getID()
const independent1892JBPartyID = Independent1892JBParty.getID()
const independent1888CFPartyID = Independent1888CFParty.getID()
const independent1860JohnBreckenridgePartyID = Independent1860JohnBreckenridgeParty.getID()
const independent1860JohnBellPartyID = Independent1860JohnBellParty.getID()
const independent1856MFPartyID = Independent1856MFParty.getID()
const independent1844JBPartyID = Independent1844JBParty.getID()
const independent1836HWPartyID = Independent1836HWParty.getID()
const independent1836DWPartyID = Independent1836DWParty.getID()
const independent1836WMPartyID = Independent1836WMParty.getID()
const independent1832WWPartyID = Independent1832WWParty.getID()
const independent1832JFPartyID = Independent1832JFParty.getID()
const independent1824AJPartyID = Independent1824AJParty.getID()
const independent1824WCPartyID = Independent1824WCParty.getID()
const independent1824HCPartyID = Independent1824HCParty.getID()
const independent1820JAPartyID = Independent1820JAParty.getID()
const independent1808GCPartyID = Independent1808GCParty.getID()
const independentGWPartyID = IndependentGWParty.getID()

const independentGenericPartyID = IndependentGenericParty.getID()

const incumbentChallengerPartyIDs = {incumbent: republicanPartyID, challenger: democraticPartyID, tossup: tossupPartyID}
const partyCandiateLastNames = {2020: {"Biden":democraticPartyID, "Trump":republicanPartyID}}
const partyCandiateFullNames = {2020: {"Joseph R. Biden Jr.":democraticPartyID, "Donald Trump":republicanPartyID}}

const partyIDToCandidateLastNames = {2020: {}}
partyIDToCandidateLastNames[2020][democraticPartyID] = "Biden"
partyIDToCandidateLastNames[2020][republicanPartyID] = "Trump"

const currentCycleYear = 2020

function createPresidentialMapSources()
{
  var singleLineMarginFilterFunction = function(rawMapData, mapDates, columnMap, cycleYear, candidateNameToPartyIDMap, regionNameToID)
  {
    var filteredMapData = {}

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var regionNames = Object.keys(regionNameToID)
      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]
        var regionRow = rawDateData.find(row => (row[columnMap.region] == regionToFind))

        var margin = columnMap.margin ? parseFloat(regionRow[columnMap.margin]) : null

        if (margin == null && columnMap.percentIncumbent && columnMap.percentChallenger)
        {
          margin = parseFloat(regionRow[columnMap.percentIncumbent]) - parseFloat(regionRow[columnMap.percentChallenger])
        }

        var winChance = columnMap.winChance ? parseFloat(regionRow[columnMap.winChance]) : null

        var incumbentWinChance
        var challengerWinChance

        if (winChance)
        {
          if (Math.sign(margin) == -1)
          {
            challengerWinChance = winChance
            incumbentWinChance = 100-winChance
          }
          else
          {
            challengerWinChance = 100-winChance
            incumbentWinChance = winChance
          }
        }
        else
        {
          incumbentWinChance = columnMap.incumbentWinChance ? regionRow[columnMap.incumbentWinChance] : null
          challengerWinChance = columnMap.challengerWinChance ? regionRow[columnMap.challengerWinChance] : null
        }

        var greaterMarginPartyID = (Math.sign(margin) == 0 ? null : (Math.sign(margin) == -1 ? incumbentChallengerPartyIDs.challenger : incumbentChallengerPartyIDs.incumbent))

        var partyIDToCandidateNames = {}
        for (var partyCandidateName in candidateNameToPartyIDMap)
        {
          partyIDToCandidateNames[candidateNameToPartyIDMap[partyCandidateName]] = partyCandidateName
        }

        filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], margin: Math.abs(margin), partyID: greaterMarginPartyID, candidateName: partyIDToCandidateLastNames[cycleYear][greaterMarginPartyID], candidateMap: partyIDToCandidateNames, chanceIncumbent: incumbentWinChance, chanceChallenger: challengerWinChance}
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
    }

    return {mapData: filteredMapData}
  }

  var doubleLineMarginFilterFunction = function(rawMapData, mapDates, columnMap, cycleYear, candidateNameToPartyIDMap, regionNameToID, heldRegionMap, shouldFilterOutDuplicateRows)
  {
    var filteredMapData = {}
    var candidateNameData = {}

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var currentMapDate = new Date(mapDates[dateNum])

      var regionNames = Object.keys(regionNameToID)
      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]

        var isMultipleElections = false
        var candidateArrayToTest = Object.keys(candidateNameToPartyIDMap)
        if (candidateArrayToTest.includes(currentMapDate.getFullYear().toString()))
        {
          isMultipleElections = true
          candidateArrayToTest = Object.keys(candidateNameToPartyIDMap[currentMapDate.getFullYear()])
        }

        var mapDataRows = rawDateData.filter(row => {
          return row[columnMap.region] == regionToFind && candidateArrayToTest.includes(row[columnMap.candidateName])
        })

        if (shouldFilterOutDuplicateRows)
        {
          // cuz JHK is stupid for a third time and has duplicate rows sometimes
          mapDataRows = mapDataRows.filter((row1, index, self) =>
            index === self.findIndex((row2) => (
              row1[columnMap.candidateName] === row2[columnMap.candidateName]
            ))
          )
        }

        var marginSum = 0
        if (mapDataRows.length <= 0 && heldRegionMap)
        {
          marginSum = heldRegionMap[regionNameToID[regionToFind]] == incumbentChallengerPartyIDs.challenger ? -100 : 100
        }

        var incumbentWinChance
        var challengerWinChance

        var partyVotesharePercentages = null

        for (var rowNum in mapDataRows)
        {
          var partyID = candidateNameToPartyIDMap[mapDataRows[rowNum][columnMap.candidateName]]
          if (Object.keys(candidateNameToPartyIDMap).includes(currentMapDate.getFullYear().toString()))
          {
            partyID = candidateNameToPartyIDMap[currentMapDate.getFullYear().toString()][mapDataRows[rowNum][columnMap.candidateName]]
          }

          if (mapDataRows[rowNum][columnMap.percentAdjusted] >= 1)
          {
            if (partyVotesharePercentages == null)
            {
              partyVotesharePercentages = []
            }
            partyVotesharePercentages.push({partyID: partyID, candidate: mapDataRows[rowNum][columnMap.candidateName], voteshare: mapDataRows[rowNum][columnMap.percentAdjusted]})
          }

          if (!(mapDates[dateNum] in candidateNameData))
          {
            candidateNameData[mapDates[dateNum]] = {}
          }
          if (!(partyID in candidateNameData[mapDates[dateNum]]))
          {
            var candidateNameToAdd
            if ("partyCandidateName" in columnMap)
            {
              candidateNameToAdd = mapDataRows[rowNum][columnMap.partyCandidateName]
            }
            else
            {
              candidateNameToAdd = mapDataRows[rowNum][columnMap.candidateName]
            }
            candidateNameData[mapDates[dateNum]][partyID] = candidateNameToAdd
          }

          if (partyID == incumbentChallengerPartyIDs.incumbent)
          {
            marginSum += parseFloat(mapDataRows[rowNum][columnMap.percentAdjusted])
            incumbentWinChance = columnMap.winChance ? mapDataRows[rowNum][columnMap.winChance] : null
          }
          else if (partyID == incumbentChallengerPartyIDs.challenger)
          {
            marginSum -= parseFloat(mapDataRows[rowNum][columnMap.percentAdjusted])
            challengerWinChance = columnMap.winChance ? mapDataRows[rowNum][columnMap.winChance] : null
          }
        }

        // if (marginSum == 0 && heldRegionMap) //cuz JHK is stupid and made pollAvg = 0 if there are no polls with no any other indication of such fact
        // {
        //   marginSum = heldRegionMap[regionNameToID[regionToFind]] == partyIDs.challenger ? -100 : 100
        // }

        //cuz JHK is stupid again and used % chances as 100x the size they should be instead of putting them in decimal form like everyone else does it
        challengerWinChance = (incumbentWinChance > 1 || challengerWinChance > 1) ? challengerWinChance/100 : challengerWinChance
        incumbentWinChance = (incumbentWinChance > 1 || challengerWinChance > 1) ? incumbentWinChance/100 : incumbentWinChance

        var greaterMarginPartyID = incumbentChallengerPartyIDs.tossup
        if (Math.sign(marginSum) == -1)
        {
          greaterMarginPartyID = incumbentChallengerPartyIDs.challenger
        }
        else if (Math.sign(marginSum) == 1)
        {
          greaterMarginPartyID = incumbentChallengerPartyIDs.incumbent
        }

        var compactPartyVotesharePercentages
        if (partyVotesharePercentages && marginSum != 0)
        {
          compactPartyVotesharePercentages = []
          partyVotesharePercentages.forEach(voteData => {
            var compactVoteDataIndex
            var compactVoteData = compactPartyVotesharePercentages.find((compactVoteData, index) => {
              if (compactVoteData.candidate == voteData.candidate)
              {
                compactVoteDataIndex = index
                return true
              }
              return false
            })
            if (compactVoteData)
            {
              compactVoteData.voteshare = parseInt(compactVoteData.voteshare)+parseInt(voteData.voteshare)
              compactPartyVotesharePercentages[compactVoteDataIndex] = compactVoteData
            }
            else
            {
              compactPartyVotesharePercentages.push(voteData)
            }
          })

          compactPartyVotesharePercentages.sort((voteData1, voteData2) => {
            return voteData2.voteshare - voteData1.voteshare
          })

          marginSum = compactPartyVotesharePercentages[0].voteshare - (compactPartyVotesharePercentages[1] || {voteshare: 0.0}).voteshare
          greaterMarginPartyID = compactPartyVotesharePercentages[0].partyID
        }

        var candidateName
        var candidateNameArray = electionYearToCandidateData[cycleYear || currentMapDate.getFullYear().toString()]
        if (candidateNameArray)
        {
          candidateName = getKeyByValue(candidateNameArray, greaterMarginPartyID)
        }

        var thisElectionCandidateNameToPartyIDMap = isMultipleElections ? candidateNameToPartyIDMap[currentMapDate.getFullYear()] : candidateNameToPartyIDMap
        var partyIDToCandidateNames = {}
        for (var partyCandidateName in thisElectionCandidateNameToPartyIDMap)
        {
          partyIDToCandidateNames[thisElectionCandidateNameToPartyIDMap[partyCandidateName]] = partyCandidateName
        }

        filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], margin: Math.abs(marginSum), partyID: greaterMarginPartyID, candidateName: candidateName, candidateMap: partyIDToCandidateNames, chanceIncumbent: incumbentWinChance, chanceChallenger: challengerWinChance, partyVotesharePercentages: compactPartyVotesharePercentages}
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
    }

    return {mapData: filteredMapData, candidateNameData: candidateNameData}
  }

  var doubleLineVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, _, candidateNameToPartyIDMap, regionNameToID, __, ____, isCustomMap, voteshareCutoffMargin, shouldIncludeVoteshare)
  {
    var filteredMapData = {}
    var partyNameData = {}

    var regionNames = Object.keys(regionNameToID)

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var currentMapDate = new Date(mapDates[dateNum])
      var currentDatePartyNameArray = {}

      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]

        var mapDataRows = rawDateData.filter(row => {
          return row[columnMap.region] == regionToFind
        })

        if (mapDataRows.length == 0)
        {
          let partyIDToCandidateNames = invertObject(candidateNameToPartyIDMap)
          if (isCustomMap)
          {
            filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], margin: 0, partyID: TossupParty.getID(), candidateMap: partyIDToCandidateNames}
          }
          else
          {
            filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], margin: 0, partyID: TossupParty.getID(), disabled: true, candidateMap: partyIDToCandidateNames}
          }
          continue
        }

        var candidateData = {}

        var currentCandidateToPartyIDMap = candidateNameToPartyIDMap
        if (Object.keys(currentCandidateToPartyIDMap).includes(currentMapDate.getFullYear().toString()))
        {
          currentCandidateToPartyIDMap = currentCandidateToPartyIDMap[currentMapDate.getFullYear()]
        }

        for (var rowNum in mapDataRows)
        {
          var row = mapDataRows[rowNum]

          var candidateName = row[columnMap.candidateName]
          var currentPartyName = row[columnMap.partyID]
          var currentVoteshare = parseFloat(row[columnMap.percentAdjusted])
          var currentElectoralVotes = row[columnMap.electoralVotes] ? parseInt(row[columnMap.electoralVotes]) : null
          var currentOrder = row[columnMap.order] ? parseInt(row[columnMap.order]) : null

          var foundParty = currentCandidateToPartyIDMap[candidateName] ? politicalParties[currentCandidateToPartyIDMap[candidateName]] : null

          if (!foundParty)
          {
            foundParty = Object.values(politicalParties).find(party => {
              var partyNames = cloneObject(party.getNames())
              for (var nameNum in partyNames)
              {
                partyNames[nameNum] = partyNames[nameNum].toLowerCase()
              }
              return partyNames.includes(currentPartyName)
            })
          }

          if (!foundParty && Object.keys(politicalParties).includes(currentPartyName))
          {
            foundParty = politicalParties[currentPartyName]
          }

          if (!foundParty || foundParty.getID() == IndependentGenericParty.getID())
          {
            var foundPartyID = majorThirdPartyCandidates.find(partyID => {
              return politicalParties[partyID].getDefaultCandidateName() == candidateName
            })
            foundParty = politicalParties[foundPartyID]
          }

          var currentPartyID
          if (foundParty)
          {
            currentPartyID = foundParty.getID()
          }
          else
          {
            currentPartyID = IndependentGenericParty.getID()
          }

          if (Object.keys(candidateData).includes(candidateName))
          {
            if (currentVoteshare > candidateData[candidateName].voteshare)
            {
              candidateData[candidateName].partyID = currentPartyID
            }

            candidateData[candidateName].voteshare += currentVoteshare
            if (candidateData[candidateName].electoralVotes != null)
            {
              candidateData[candidateName].electoralVotes += currentElectoralVotes ? currentElectoralVotes : 0
            }
          }
          else
          {
            candidateData[candidateName] = {candidate: candidateName, partyID: currentPartyID, voteshare: currentVoteshare, electoralVotes: currentElectoralVotes, order: currentOrder}
          }
        }

        var voteshareSortedCandidateData = Object.values(candidateData).map(singleCandidateData => {
          return {candidate: singleCandidateData.candidate, partyID: singleCandidateData.partyID, voteshare: singleCandidateData.voteshare, order: singleCandidateData.order}
        })
        voteshareSortedCandidateData = voteshareSortedCandidateData.filter((candData) => !isNaN(candData.voteshare))
        voteshareSortedCandidateData.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
        if (!isCustomMap && voteshareCutoffMargin != null)
        {
          voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)
        }

        if (voteshareSortedCandidateData.length == 0)
        {
          console.log("No candidate data!", currentMapDate.getFullYear().toString(), regionToFind)
          continue
        }

        var electoralVoteSortedCandidateData = Object.values(candidateData).map(singleCandidateData => {
          return {candidate: singleCandidateData.candidate, partyID: singleCandidateData.partyID, votes: singleCandidateData.electoralVotes}
        }).filter(candVotes => candVotes.votes != null)
        electoralVoteSortedCandidateData.sort((cand1, cand2) => cand2.votes - cand1.votes)

        var greatestMarginPartyID
        var greatestMarginCandidateName
        var topTwoMargin

        if (voteshareSortedCandidateData[0].voteshare != 0)
        {
          let topCandidateData = voteshareSortedCandidateData.filter(candidateData => candidateData.order == 0 || candidateData.order == 1).sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
          if (topCandidateData.length == 0)
          {
            topCandidateData = [voteshareSortedCandidateData[0]]
            if (voteshareSortedCandidateData[1])
            {
              topCandidateData.push(voteshareSortedCandidateData[1])
            }
          }

          greatestMarginPartyID = topCandidateData[0].partyID
          greatestMarginCandidateName = topCandidateData[0].candidate
          topTwoMargin = topCandidateData[0].voteshare - (topCandidateData[1] ? topCandidateData[1].voteshare : 0)
        }
        else
        {
          greatestMarginPartyID = TossupParty.getID()
          greatestMarginCandidateName = null
          topTwoMargin = 0
        }

        for (var candidateDataNum in voteshareSortedCandidateData)
        {
          var mainPartyID = voteshareSortedCandidateData[candidateDataNum].partyID
          currentDatePartyNameArray[mainPartyID] = politicalParties[mainPartyID].getNames()[0]
        }

        var partyIDToCandidateNames = {}
        for (let partyCandidateName in candidateData)
        {
          partyIDToCandidateNames[candidateData[partyCandidateName].partyID] = partyCandidateName
        }

        for (let candidateElectoralVote of electoralVoteSortedCandidateData)
        {
          if (!currentDatePartyNameArray[candidateElectoralVote.partyID]) { continue }
          currentDatePartyNameArray[candidateElectoralVote.partyID] = candidateElectoralVote.candidate
        }

        var mostRecentParty = mostRecentWinner(filteredMapData, currentMapDate.getTime(), regionNameToID[regionToFind])
        filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, disabled: mapDataRows[0][columnMap.disabled] == "true", candidateMap: partyIDToCandidateNames, partyVotesharePercentages: shouldIncludeVoteshare ? voteshareSortedCandidateData : null, voteSplits: electoralVoteSortedCandidateData, flip: mostRecentParty != greatestMarginPartyID && mostRecentParty != TossupParty.getID()}
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
      partyNameData[mapDates[dateNum]] = currentDatePartyNameArray
    }

    return {mapData: filteredMapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  var countyVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, _, __, regionNameToID, ___, _____, isCustomMap, voteshareCutoffMargin)
  {
    var filteredMapData = {}
    var partyNameData = {}

    var regionNames = Object.keys(regionNameToID)

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var currentMapDate = new Date(mapDates[dateNum])
      var currentDatePartyNameArray = {}

      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]

        var fullStateRows = rawDateData.filter(row => {
          return row[columnMap.region] == regionToFind
        })

        if (fullStateRows.length == 0)
        {
          continue
        }

        var stateCounties = [...new Set(fullStateRows.map(row => {
          return row[columnMap.county]
        }))]

        if (stateCounties.length == 0)
        {
          console.log(regionToFind, currentMapDate)
        }

        for (let stateCounty of stateCounties)
        {
          var countyRows = fullStateRows.filter(row => {
            return row[columnMap.county] == stateCounty
          })

          var fullRegionName = regionToFind + (regionToFind != "NPV" ? "__" + stateCounty : "")

          var candidateData = {}
          var totalVoteshare = 0

          for (var rowNum in countyRows)
          {
            var row = countyRows[rowNum]

            var candidateName = row[columnMap.candidateName]
            var candidateVotes = parseFloat(row[columnMap.candidateVotes])
            var currentVoteshare = candidateVotes/parseFloat(row[columnMap.totalVotes])*100

            var currentPartyName = row[columnMap.partyID]
            var foundParty = Object.values(politicalParties).find(party => {
              var partyNames = cloneObject(party.getNames())
              for (var nameNum in partyNames)
              {
                partyNames[nameNum] = partyNames[nameNum].toLowerCase()
              }
              return partyNames.includes(currentPartyName)
            })

            if (!foundParty && Object.keys(politicalParties).includes(currentPartyName))
            {
              foundParty = politicalParties[currentPartyName]
            }

            var currentPartyID
            if (foundParty)
            {
              currentPartyID = foundParty.getID()
            }
            else
            {
              currentPartyID = IndependentGenericParty.getID()
            }

            if (Object.keys(candidateData).includes(candidateName))
            {
              if (currentVoteshare > candidateData[candidateName].voteshare)
              {
                candidateData[candidateName].partyID = currentPartyID
              }

              candidateData[candidateName].voteshare += currentVoteshare
              candidateData[candidateName].votes += candidateVotes
            }
            else
            {
              candidateData[candidateName] = {candidate: candidateName, partyID: currentPartyID, voteshare: currentVoteshare, votes: candidateVotes}
            }

            totalVoteshare += currentVoteshare
          }

          if (totalVoteshare > 100.1)
          {
            console.log("Overflow voteshare!", currentMapDate.getFullYear().toString(), fullRegionName)
          }

          var voteshareSortedCandidateData = Object.values(candidateData)
          voteshareSortedCandidateData = voteshareSortedCandidateData.filter((candData) => !isNaN(candData.voteshare))
          voteshareSortedCandidateData.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
          if (!isCustomMap && voteshareCutoffMargin != null)
          {
            voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)
          }

          if (voteshareSortedCandidateData.length == 0)
          {
            console.log("No candidate data!", currentMapDate.getFullYear().toString(), fullRegionName)
            continue
          }

          var greatestMarginPartyID
          var greatestMarginCandidateName
          var topTwoMargin

          if (voteshareSortedCandidateData[0].voteshare > 0)
          {
            greatestMarginPartyID = voteshareSortedCandidateData[0].partyID
            greatestMarginCandidateName = voteshareSortedCandidateData[0].candidate
            topTwoMargin = voteshareSortedCandidateData[0].voteshare - (voteshareSortedCandidateData[1] ? voteshareSortedCandidateData[1].voteshare : 0)
          }
          else
          {
            greatestMarginPartyID = TossupParty.getID()
            greatestMarginCandidateName = null
            topTwoMargin = 0
          }

          for (var candidateDataNum in voteshareSortedCandidateData)
          {
            var mainPartyID = voteshareSortedCandidateData[candidateDataNum].partyID
            currentDatePartyNameArray[mainPartyID] = politicalParties[mainPartyID].getNames()[0]
          }

          var partyIDToCandidateNames = {}
          for (let partyCandidateName in candidateData)
          {
            partyIDToCandidateNames[candidateData[partyCandidateName].partyID] = partyCandidateName
          }

          var mostRecentParty = mostRecentWinner(filteredMapData, currentMapDate.getTime(), fullRegionName)
          filteredDateData[fullRegionName] = {region: fullRegionName, state: regionToFind, county: stateCounty, margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: voteshareSortedCandidateData, flip: mostRecentParty != greatestMarginPartyID && mostRecentParty != TossupParty.getID()}
        }
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
      partyNameData[mapDates[dateNum]] = currentDatePartyNameArray
    }

    return {mapData: filteredMapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  function mostRecentWinner(mapData, dateToStart, regionID)
  {
    var reversedMapDates = cloneObject(Object.keys(mapData)).reverse()

    var startYear = (new Date(parseInt(dateToStart))).getFullYear()

    for (var dateNum in reversedMapDates)
    {
      if (reversedMapDates[dateNum] >= parseInt(dateToStart)) { continue }

      var currentYear = (new Date(parseInt(reversedMapDates[dateNum]))).getFullYear()

      if (startYear-currentYear > 4)
      {
        return TossupParty.getID()
      }

      var mapDataFromDate = mapData[reversedMapDates[dateNum]]
      if (regionID in mapDataFromDate)
      {
        return mapDataFromDate[regionID].partyID
      }
    }

    return TossupParty.getID()
  }

  function customMapConvertMapDataToCSVFunction(columnKey, mapDateString, regionID, regionNameToID, candidateName, partyID, regionData, shouldUseVoteshare)
  {
    switch (columnKey)
    {
      case "date":
      return mapDateString

      case "candidateName":
      return candidateName

      case "partyID":
      return partyID || electionYearToCandidateData[currentCycleYear || 2020][candidateName]

      case "percentAdjusted":
      var voteshareData = shouldUseVoteshare && regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.voteshare
      }
      else if (regionData.partyID == partyID)
      {
        return regionData.margin
      }
      return 0

      case "order":
      var voteshareData = regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.order
      }
      return ""

      case "region":
      if (regionNameToID)
      {
        return getKeyByValue(regionNameToID, regionID)
      }
      else
      {
        return regionID
      }

      case "disabled":
      return regionData.disabled || false
    }
  }

  const electionYearToCandidateData = {
    1788: {"Washington":independentGWPartyID},
    1792: {"Washington":independentGWPartyID},
    1796: {"Jefferson":democraticRepublicanPartyID, "Adams":federalistPartyID},
    1800: {"Jefferson":democraticRepublicanPartyID, "Adams":federalistPartyID},
    1804: {"Jefferson":democraticRepublicanPartyID, "Pinckney":federalistPartyID},
    1808: {"Madison":democraticRepublicanPartyID, "Pinckney":federalistPartyID, "Clinton":independent1808GCPartyID},
    1812: {"Madison":democraticRepublicanPartyID, "Clinton":federalistPartyID},
    1816: {"Monroe":democraticRepublicanPartyID, "King":federalistPartyID},
    1820: {"Monroe":democraticRepublicanPartyID, "Adams":independent1820JAPartyID},
    1824: {"Adams":democraticRepublicanPartyID, "Jackson":independent1824AJPartyID, "Crawford":independent1824WCPartyID, "Clay":independent1824HCPartyID, "Other":independentGenericPartyID},
    1828: {"Jackson":democraticPartyID, "Adams":nationalRepublicanPartyID, "Other":independentGenericPartyID},
    1832: {"Jackson":democraticPartyID, "Clay":nationalRepublicanPartyID, "Wirt":independent1832WWPartyID, "Floyd":independent1832JFPartyID, "Other":independentGenericPartyID},
    1836: {"Van Buren":democraticPartyID, "Harrison":whigPartyID, "White":independent1836HWPartyID, "Webster":independent1836DWPartyID, "Magnum":independent1836WMPartyID, "Other":independentGenericPartyID},
    1840: {"Van Buren":democraticPartyID, "Harrison":whigPartyID, "Other":independentGenericPartyID},
    1844: {"Polk":democraticPartyID, "Clay":whigPartyID, "Birney":independent1844JBPartyID, "Other":independentGenericPartyID},
    1848: {"Cass":democraticPartyID, "Taylor":whigPartyID, "Van Buren":freeSoilPartyID, "Other":independentGenericPartyID},
    1852: {"Pierce":democraticPartyID, "Scott":whigPartyID, "Hale":freeSoilPartyID, "Other":independentGenericPartyID},
    1856: {"Buchanan":democraticPartyID, "Fremont":republicanPartyID, "Fillmore":independent1856MFPartyID, "Other":independentGenericPartyID},
    1860: {"Douglas":democraticPartyID, "Lincoln":republicanPartyID, "Breckenridge":independent1860JohnBreckenridgePartyID, "Bell":independent1860JohnBellPartyID, "Other":independentGenericPartyID},
    1864: {"McClellan":democraticPartyID, "Lincoln":republicanPartyID, "Other":independentGenericPartyID},
    1868: {"Seymour":democraticPartyID, "Grant":republicanPartyID, "Other":independentGenericPartyID},
    1872: {"Greeley":democraticPartyID, "Grant":republicanPartyID, "Other":independentGenericPartyID},
    1876: {"Tilden":democraticPartyID, "Hayes":republicanPartyID, "Other":independentGenericPartyID},
    1880: {"Hancock":democraticPartyID, "Garfield":republicanPartyID, "Weaver":independent1892JWPartyID, "Other":independentGenericPartyID},
    1884: {"Cleveland":democraticPartyID, "Blaine":republicanPartyID, "Other":independentGenericPartyID},
    1888: {"Cleveland":democraticPartyID, "Harrison":republicanPartyID, "Fisk":independent1888CFPartyID, "Other":independentGenericPartyID},
    1892: {"Cleveland":democraticPartyID, "Harrison":republicanPartyID, "Weaver":independent1892JWPartyID, "Bidwell":independent1892JBPartyID, "Other":independentGenericPartyID},
    1896: {"Bryan":democraticPartyID, "McKinley":republicanPartyID, "Other":independentGenericPartyID},
    1900: {"Bryan":democraticPartyID, "McKinley":republicanPartyID, "Other":independentGenericPartyID},
    1904: {"Parker":democraticPartyID, "Roosevelt":republicanPartyID, "Debs":independent1912EDPartyID, "Other":independentGenericPartyID},
    1908: {"Bryan":democraticPartyID, "Taft":republicanPartyID, "Debs":independent1912EDPartyID, "Other":independentGenericPartyID},
    1912: {"Wilson":democraticPartyID, "Taft":republicanPartyID, "Roosevelt":independent1912TRPartyID, "Debs":independent1912EDPartyID, "Other":independentGenericPartyID},
    1916: {"Wilson":democraticPartyID, "Hughes":republicanPartyID, "Benson":independent1916ABPartyID, "Other":independentGenericPartyID},
    1920: {"Cox":democraticPartyID, "Harding":republicanPartyID, "Debs":independent1920EDPartyID, "Other":independentGenericPartyID},
    1924: {"Davis":democraticPartyID, "Coolidge":republicanPartyID, "La Follette":independent1924RLPartyID, "Other":independentGenericPartyID},
    1928: {"Smith":democraticPartyID, "Hoover":republicanPartyID, "Other":independentGenericPartyID},
    1932: {"Roosevelt":democraticPartyID, "Hoover":republicanPartyID, "Thomas":independent1932NTPartyID, "Other":independentGenericPartyID},
    1936: {"Roosevelt":democraticPartyID, "Landon":republicanPartyID, "Other":independentGenericPartyID},
    1940: {"Roosevelt":democraticPartyID, "Willkie":republicanPartyID, "Other":independentGenericPartyID},
    1944: {"Roosevelt":democraticPartyID, "Dewey":republicanPartyID, "Other":independentGenericPartyID},
    1948: {"Truman":democraticPartyID, "Dewey":republicanPartyID, "Thurmond":independent1948SMPartyID, "Wallace":independent1948HWPartyID, "Other":independentGenericPartyID},
    1952: {"Stevenson":democraticPartyID, "Eisenhower":republicanPartyID, "Other":independentGenericPartyID},
    1956: {"Stevenson":democraticPartyID, "Eisenhower":republicanPartyID, "Jones":independent1956WJPartyID, "Other":independentGenericPartyID},
    1960: {"Kennedy":democraticPartyID, "Nixon":republicanPartyID, "Byrd":independent1960HBPartyID, "Other":independentGenericPartyID},
    1964: {"Johnson":democraticPartyID, "Goldwater":republicanPartyID, "Other":independentGenericPartyID},
    1968: {"Humphrey":democraticPartyID, "Nixon":republicanPartyID, "Wallace":independent1968GWPartyID, "Other":independentGenericPartyID},
    1972: {"McGovern":democraticPartyID, "Nixon":republicanPartyID, "Other":independentGenericPartyID},
    1976: {"Carter":democraticPartyID, "Ford":republicanPartyID, "McCarthy":independent1976EMPartyID, "Reagan": independent1976RRPartyID},
    1980: {"Carter":democraticPartyID, "Reagan":republicanPartyID, "Anderson":independent1980JAPartyID, "Clark":libertarianPartyID},
    1984: {"Mondale":democraticPartyID, "Reagan":republicanPartyID, "Bergland":libertarianPartyID},
    1988: {"Dukakis":democraticPartyID, "Bush":republicanPartyID, "Paul":libertarianPartyID, "Bentsen": independent1988LBPartyID},
    1992: {"Clinton":democraticPartyID, "Bush":republicanPartyID, "Perot":reformPartyID, "Marrou":libertarianPartyID},
    1996: {"Clinton":democraticPartyID, "Dole":republicanPartyID, "Perot":reformPartyID, "Nader":greenPartyID, "Browne":libertarianPartyID},
    2000: {"Gore":democraticPartyID, "Bush":republicanPartyID, "Nader":greenPartyID, "Buchanan":reformPartyID, "Browne":libertarianPartyID},
    2004: {"Kerry":democraticPartyID, "Bush":republicanPartyID, "Nader":independentRNPartyID, "Badnarik":libertarianPartyID, "Edwards": independent2004JEPartyID},
    2008: {"Obama":democraticPartyID, "McCain":republicanPartyID, "Nader":independentRNPartyID, "Barr":libertarianPartyID},
    2012: {"Obama":democraticPartyID, "Romney":republicanPartyID, "Johnson":libertarianPartyID, "Stein":greenPartyID},
    2016: {"Clinton":democraticPartyID, "Trump":republicanPartyID, "Johnson":libertarianPartyID, "Stein":greenPartyID, "McMullin":independent2016EMPartyID, "Powell":independent2016CPPartyID, "Sanders":independent2016BSPartyID, "Paul":independent2016RPPartyID, "Kasich":independent2016JKPartyID, "Spotted Eagle":independent2016SEPartyID},
    2020: {"Biden":democraticPartyID, "Trump":republicanPartyID, "Jorgensen":libertarianPartyID, "Hawkins":greenPartyID}
  }

  const ev2016 = {"AL":republicanPartyID, "AK":republicanPartyID, "AZ":republicanPartyID, "AR":republicanPartyID, "CA":democraticPartyID, "CO":democraticPartyID, "CT":democraticPartyID, "DE":democraticPartyID, "DC":democraticPartyID, "FL":republicanPartyID, "GA":republicanPartyID, "HI":democraticPartyID, "ID":republicanPartyID, "IL":democraticPartyID, "IN":republicanPartyID, "IA":republicanPartyID, "KS":republicanPartyID, "KY":republicanPartyID, "LA":republicanPartyID, "ME-D1":democraticPartyID, "ME-D2":republicanPartyID, "ME-AL":democraticPartyID, "MD":democraticPartyID, "MA":democraticPartyID, "MI":republicanPartyID, "MN":democraticPartyID, "MS":republicanPartyID, "MO":republicanPartyID, "MT":republicanPartyID, "NE-DrepublicanPartyID":republicanPartyID, "NE-D2":republicanPartyID, "NE-D3":republicanPartyID, "NE-AL":republicanPartyID, "NV":democraticPartyID, "NH":democraticPartyID, "NJ":democraticPartyID, "NM":democraticPartyID, "NY":democraticPartyID, "NC":republicanPartyID, "ND":republicanPartyID, "OH":republicanPartyID, "OK":republicanPartyID, "OR":democraticPartyID, "PA":republicanPartyID, "RI":democraticPartyID, "SC":republicanPartyID, "SD":republicanPartyID, "TN":republicanPartyID, "TX":republicanPartyID, "UT":republicanPartyID, "VT":democraticPartyID, "VA":democraticPartyID, "WA":democraticPartyID, "WV":republicanPartyID, "WI":republicanPartyID, "WY":republicanPartyID}

  const regionNameToIDFiveThirtyEight = {"Alabama":"AL", "Alaska":"AK", "Arizona":"AZ", "Arkansas":"AR", "California":"CA", "Colorado":"CO", "Connecticut":"CT", "Delaware":"DE", "District of Columbia":"DC", "Florida":"FL", "Georgia":"GA", "Hawaii":"HI", "Idaho":"ID", "Illinois":"IL", "Indiana":"IN", "Iowa":"IA", "Kansas":"KS", "Kentucky":"KY", "Louisiana":"LA", "ME-1":"ME-D1", "ME-2":"ME-D2", "Maine":"ME-AL", "Maryland":"MD", "Massachusetts":"MA", "Michigan":"MI", "Minnesota":"MN", "Mississippi":"MS", "Missouri":"MO", "Montana":"MT", "NE-1":"NE-D1", "NE-2":"NE-D2", "NE-3":"NE-D3", "Nebraska":"NE-AL", "Nevada":"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", "Ohio":"OH", "Oklahoma":"OK", "Oregon":"OR", "Pennsylvania":"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", "Tennessee":"TN", "Texas":"TX", "Utah":"UT", "Vermont":"VT", "Virginia":"VA", "Washington":"WA", "West Virginia":"WV", "Wisconsin":"WI", "Wyoming":"WY"}
  const regionNameToIDCook = {"Alabama":"AL", "Alaska":"AK", "Arizona":"AZ", "Arkansas":"AR", "California":"CA", "Colorado":"CO", "Connecticut":"CT", "Delaware":"DE", "Washington DC":"DC", "Florida":"FL", "Georgia":"GA", "Hawaii":"HI", "Idaho":"ID", "Illinois":"IL", "Indiana":"IN", "Iowa":"IA", "Kansas":"KS", "Kentucky":"KY", "Louisiana":"LA", "Maine 1st CD":"ME-D1", "Maine 2nd CD":"ME-D2", "Maine":"ME-AL", "Maryland":"MD", "Massachusetts":"MA", "Michigan":"MI", "Minnesota":"MN", "Mississippi":"MS", "Missouri":"MO", "Montana":"MT", "Nebraska 1st CD":"NE-D1", "Nebraska 2nd CD":"NE-D2", "Nebraska 3rd CD":"NE-D3", "Nebraska":"NE-AL", "Nevada":"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", "Ohio":"OH", "Oklahoma":"OK", "Oregon":"OR", "Pennsylvania":"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", "Tennessee":"TN", "Texas":"TX", "Utah":"UT", "Vermont":"VT", "Virginia":"VA", "Washington":"WA", "West Virginia":"WV", "Wisconsin":"WI", "Wyoming":"WY"}
  const regionNameToIDHistorical = {"Alabama":"AL", "Alaska":"AK", "Arizona":"AZ", "Arkansas":"AR", "California":"CA", "Colorado":"CO", "Connecticut":"CT", "Delaware":"DE", "District of Columbia":"DC", "Florida":"FL", "Georgia":"GA", "Hawaii":"HI", "Idaho":"ID", "Illinois":"IL", "Indiana":"IN", "Iowa":"IA", "Kansas":"KS", "Kentucky":"KY", "Louisiana":"LA", "Maine":"ME-AL", "Maine 1st CD":"ME-D1", "Maine 2nd CD":"ME-D2", "Maryland":"MD", "Massachusetts":"MA", "Michigan":"MI", "Minnesota":"MN", "Mississippi":"MS", "Missouri":"MO", "Montana":"MT", "Nebraska":"NE-AL", "Nebraska 1st CD":"NE-D1", "Nebraska 2nd CD": "NE-D2", "Nebraska 3rd CD":"NE-D3", "Nevada":"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", "Ohio":"OH", "Oklahoma":"OK", "Oregon":"OR", "Pennsylvania":"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", "Tennessee":"TN", "Texas":"TX", "Utah":"UT", "Vermont":"VT", "Virginia":"VA", "Washington":"WA", "West Virginia":"WV", "Wisconsin":"WI", "Wyoming":"WY", "National Popular Vote":"NPV"}
  const regionNameToIDCounty = {"AL":"AL", "AK":"AK", "AZ":"AZ", "AR":"AR", "CA":"CA", "CO":"CO", "CT":"CT", "DE":"DE", "DC":"DC", "FL":"FL", "GA":"GA", "HI":"HI", "ID":"ID", "IL":"IL", "IN":"IN", "IA":"IA", "KS":"KS", "KY":"KY", "LA":"LA", "ME":"ME", "MD":"MD", "MA":"MA", "MI":"MI", "MN":"MN", "MS":"MS", "MO":"MO", "MT":"MT", "NE":"NE", "NV":"NV", "NH":"NH", "NJ":"NJ", "NM":"NM", "NY":"NY", "NC":"NC", "ND":"ND", "OH":"OH", "OK":"OK", "OR":"OR", "PA":"PA", "RI":"RI", "SC":"SC", "SD":"SD", "TN":"TN", "TX":"TX", "UT":"UT", "VT":"VT", "VA":"VA", "WA":"WA", "WV":"WV", "WI":"WI", "WY":"WY", "NPV":"NPV"}
  const regionNameToIDCustom = {"Alabama":"AL", "Alaska":"AK", "Arizona":"AZ", "Arkansas":"AR", "California":"CA", "Colorado":"CO", "Connecticut":"CT", "Delaware":"DE", "District of Columbia":"DC", "Florida":"FL", "Georgia":"GA", "Hawaii":"HI", "Idaho":"ID", "Illinois":"IL", "Indiana":"IN", "Iowa":"IA", "Kansas":"KS", "Kentucky":"KY", "Louisiana":"LA", "ME-1":"ME-D1", "ME-2":"ME-D2", "Maine":"ME-AL", "Maryland":"MD", "Massachusetts":"MA", "Michigan":"MI", "Minnesota":"MN", "Mississippi":"MS", "Missouri":"MO", "Montana":"MT", "NE-1":"NE-D1", "NE-2":"NE-D2", "NE-3":"NE-D3", "Nebraska":"NE-AL", "Nevada":"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", "Ohio":"OH", "Oklahoma":"OK", "Oregon":"OR", "Pennsylvania":"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", "Tennessee":"TN", "Texas":"TX", "Utah":"UT", "Vermont":"VT", "Virginia":"VA", "Washington":"WA", "West Virginia":"WV", "Wisconsin":"WI", "Wyoming":"WY", "National Popular Vote":"NPV"}

  var FiveThirtyEightPollAverageMapSource = new MapSource(
    "538-2020-Presidential-PollAvg", // id
    "538 Poll Avg", // name
    "https://projects.fivethirtyeight.com/2020-general-data/presidential_poll_averages_2020.csv", // dataURL
    "https://projects.fivethirtyeight.com/polls/president-general/", // homepageURL
    {regular: "./assets/fivethirtyeight-large.png", mini: "./assets/fivethirtyeight.png"}, // iconURL
    {
      date: "modeldate",
      region: "state",
      candidateName: "candidate_name",
      percentAdjusted: "pct_trend_adjusted"
    }, // columnMap
    2020, // cycleYear
    partyCandiateFullNames, // candidateNameToPartyIDMap
    partyIDToCandidateLastNames, // shortCandidateNameOverride
    regionNameToIDFiveThirtyEight, // regionNameToIDMap
    {"AL":"alabama", "AK":"alaska", "AZ":"arizona", "AR":"arkansas", "CA":"california", "CO":"colorado", "CT":"connecticut", "DE":"delaware", "DC":"district-of-columbia", "FL":"florida", "GA":"georgia", "HI":"hawaii", "ID":"idaho", "IL":"illinois", "IN":"indiana", "IA":"iowa", "KS":"kansas", "KY":"kentucky", "LA":"louisiana", "ME-D1":"maine/1", "ME-D2":"maine/2", "ME-AL":"maine", "MD":"maryland", "MA":"massachusetts", "MI":"michigan", "MN":"minnesota", "MS":"mississippi", "MO":"missouri", "MT":"montana", "NE-D1":"nebraska/1", "NE-D2":"nebraska/2", "NE-D3":"nebraska/3", "NE-AL":"nebraska", "NV":"nevada", "NH":"new-hampshire", "NJ":"new-jersey", "NM":"new-mexico", "NY":"new-york", "NC":"north-carolina", "ND":"north-dakota", "OH":"ohio", "OK":"oklahoma", "OR":"oregon", "PA":"pennsylvania", "RI":"rhode-island", "SC":"south-carolina", "SD":"south-dakota", "TN":"tennessee", "TX":"texas", "UT":"utah", "VT":"vermont", "VA":"virginia", "WA":"washington", "WV":"west-virginia", "WI":"wisconsin", "WY":"wyoming"}, // regionIDToLinkMap
    ev2016, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineMarginFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    null // updateCustomMapFunction
  )

  var FiveThirtyEightProjectionMapSource = new MapSource(
    "538-2020-Presidential-Projection", // id
    "538 Projection", // name
    "https://projects.fivethirtyeight.com/2020-general-data/presidential_state_toplines_2020.csv", // dataURL
    "https://projects.fivethirtyeight.com/2020-election-forecast/", // homepageURL
    {regular: "./assets/fivethirtyeight-large.png", mini: "./assets/fivethirtyeight.png"}, // iconURL
    {
      date: "modeldate",
      region: "state",
      margin: "margin",
      incumbentWinChance: "winstate_inc",
      challengerWinChance: "winstate_chal"
    }, // columnMap
    2020, // cycleYear
    partyCandiateLastNames, // candidateNameToPartyIDMap
    partyIDToCandidateLastNames, // shortCandidateNameOverride
    regionNameToIDFiveThirtyEight, // regionNameToIDMap
    {"AL":"alabama", "AK":"alaska", "AZ":"arizona", "AR":"arkansas", "CA":"california", "CO":"colorado", "CT":"connecticut", "DE":"delaware", "DC":"district-of-columbia", "FL":"florida", "GA":"georgia", "HI":"hawaii", "ID":"idaho", "IL":"illinois", "IN":"indiana", "IA":"iowa", "KS":"kansas", "KY":"kentucky", "LA":"louisiana", "ME-D1":"maine-1", "ME-D2":"maine-2", "ME-AL":"maine", "MD":"maryland", "MA":"massachusetts", "MI":"michigan", "MN":"minnesota", "MS":"mississippi", "MO":"missouri", "MT":"montana", "NE-D1":"nebraska-1", "NE-D2":"nebraska-2", "NE-D3":"nebraska-3", "NE-AL":"nebraska", "NV":"nevada", "NH":"new-hampshire", "NJ":"new-jersey", "NM":"new-mexico", "NY":"new-york", "NC":"north-carolina", "ND":"north-dakota", "OH":"ohio", "OK":"oklahoma", "OR":"oregon", "PA":"pennsylvania", "RI":"rhode-island", "SC":"south-carolina", "SD":"south-dakota", "TN":"tennessee", "TX":"texas", "UT":"utah", "VT":"vermont", "VA":"virginia", "WA":"washington", "WV":"west-virginia", "WI":"wisconsin", "WY":"wyoming"}, // regionIDToLinkMap
    ev2016, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    singleLineMarginFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    null // updateCustomMapFunction
  )

  var CookProjectionMapSource = new MapSource(
    "Cook-2020-Presidential", // id
    "Cook Political", // name
    "./csv-sources/cook-pres-2020/cook-latest.csv", // dataURL
    "./csv-sources/cook-pres-2020/", // homepageURL
    {regular: "./assets/cookpolitical-large.png", mini: "./assets/cookpolitical.png"}, // iconURL
    {
      date: "date",
      region: "region",
      margin: "margin"
    }, // columnMap
    2020, // cycleYear
    partyCandiateLastNames, // candidateNameToPartyIDMap
    partyIDToCandidateLastNames, // shortCandidateNameOverride
    regionNameToIDCook, // regionNameToIDMap
    null, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    singleLineMarginFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, _, __, mapDate, ___)
    {
      if (mapDate == null) { return }
      window.open(homepageURL + mapDate.getFullYear() + zeroPadding(mapDate.getMonth()+1) + mapDate.getDate() + ".pdf")
    }, // customOpenRegionLinkFunction
    null // updateCustomMapFunction
  )

  var getPresidentialSVGFromDate = async function(dateTime)
  {
    var dateYear = (new Date(dateTime)).getFullYear()

    if (currentViewingState == ViewingState.zooming || currentMapType.getMapSettingValue("showAllDistricts"))
    {
      if (currentMapZoomRegion.includes("-"))
      {
        let stateID = currentMapZoomRegion.split("-")[0]
        if (stateID == "NE" || stateID == "ME")
        {
          currentMapZoomRegion = stateID
        }
      }
      if (await PastElectionResultMapSource.canZoom(PastElectionResultMapSource.getMapData(), true))
      {
        return ["svg-sources/usa-counties-map.svg", currentMapZoomRegion]
      }
      else
      {
        return ["svg-sources/usa-governor-map.svg", currentMapZoomRegion]
      }
    }

    if (dateYear < 1820)
    {
      return "svg-sources/usa-presidential-pre-1820-map.svg"
    }
    else if (dateYear < 1864)
    {
      return "svg-sources/usa-presidential-pre-1864-map.svg"
    }
    else if (dateYear < 1960)
    {
      return "svg-sources/usa-presidential-pre-1960-map.svg"
    }
    else if (dateYear < 1972)
    {
      return "svg-sources/usa-presidential-pre-1972-map.svg"
    }
    else  if (dateYear < 1992)
    {
      return "svg-sources/usa-presidential-pre-1992-map.svg"
    }
    else
    {
      return "svg-sources/usa-presidential-map.svg"
    }
  }

  var pastElectoralVoteCounts = async (mapDateData) => {
    if (new Date(getCurrentDateOrToday()).getFullYear() >= 1824 && currentMapType.getMapSettingValue("presViewingType") === false && currentViewingState == ViewingState.splitVote)
    {
      currentViewingState = ViewingState.viewing
      return mapDateData
    }

    let voteSplitMapDateData = {}

    for (let regionID in mapDateData)
    {
      let regionData = cloneObject(mapDateData[regionID])
      voteSplitMapDateData[regionID] = regionData
      if (mapDateData[regionID].disabled) { continue }
      if (!regionData.voteSplits || !regionData.voteSplits[0])
      {
        let currentRegionEV = currentMapType.getEV(getCurrentDecade(), regionID, regionData)
        regionData.voteSplits = [{partyID: regionData.partyID, candidate: regionData.candidateMap && regionData.candidateMap[regionData.partyID], votes: currentRegionEV}]
      }
      regionData.margin = 100
      regionData.partyID = regionData.voteSplits[0].partyID
    }

    if (Object.keys(voteSplitMapDateData).length == 0) { return mapDateData }

    return voteSplitMapDateData
  }

  var countyZoomingDataFunction = async (presidentialMapDateData, _, isZoomCheck) => {
    if (!CountyElectionResultMapSource.getMapData() || !(await CSVDatabase.isSourceUpdated(CountyElectionResultMapSource.getID())))
    {
      if (isZoomCheck) { return null }

      await CountyElectionResultMapSource.loadMap()
    }
    let mapDateData = CountyElectionResultMapSource.getMapData()[currentSliderDate.getTime()]
    if (mapDateData == null && isZoomCheck) { return null }

    let countyZoomData = {}

    let popularVoteRegionIDToUse = currentMapZoomRegion
    if (popularVoteRegionIDToUse == "NE" || popularVoteRegionIDToUse == "ME")
    {
      popularVoteRegionIDToUse += "-AL"
    }
    countyZoomData[currentMapZoomRegion + subregionSeparator + statePopularVoteDistrictID] = presidentialMapDateData[popularVoteRegionIDToUse]

    if (mapDateData != null)
    {
      for (let regionID in mapDateData)
      {
        if (mapDateData[regionID].state == currentMapZoomRegion)
        {
          countyZoomData[regionID] = mapDateData[regionID]
          countyZoomData[regionID].voteWorth = 1
        }
      }
    }
    else
    {
      countyZoomData[currentMapZoomRegion] = presidentialMapDateData[popularVoteRegionIDToUse]
    }

    return countyZoomData
  }

  var PastElectionResultMapSource = new MapSource(
    "Past-Presidential-Elections", // id
    "Past Elections", // name
    "./csv-sources/past-president.csv", // dataURL
    "https://en.wikipedia.org/wiki/", // homepageURL
    "./assets/wikipedia-large.png", // iconURL
    {
      date: "date",
      region: "region",
      percentAdjusted: "voteshare",
      electoralVotes: "ev",
      partyID: "party",
      partyCandidateName: "candidate",
      candidateName: "candidate"
    }, // columnMap
    null, // cycleYear
    electionYearToCandidateData, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    {"AL":"Alabama", "AK":"Alaska", "AZ":"Arizona", "AR":"Arkansas", "CA":"California", "CO":"Colorado", "CT":"Connecticut", "DE":"Delaware", "DC":"the_District_of_Columbia", "FL":"Florida", "GA":"Georgia", "HI":"Hawaii", "ID":"Idaho", "IL":"Illinois", "IN":"Indiana", "IA":"Iowa", "KS":"Kansas", "KY":"Kentucky", "LA":"Louisiana", "ME-D1":"Maine", "ME-D2":"Maine", "ME-AL":"Maine", "ME":"Maine", "MD":"Maryland", "MA":"Massachusetts", "MI":"Michigan", "MN":"Minnesota", "MS":"Mississippi", "MO":"Missouri", "MT":"Montana", "NE-D1":"Nebraska", "NE-D2":"Nebraska", "NE-D3":"Nebraska", "NE-AL":"Nebraska", "NE":"Nebraska", "NV":"Nevada", "NH":"New_Hampshire", "NJ":"New_Jersey", "NM":"New_Mexico", "NY":"New_York", "NC":"North_Carolina", "ND":"North_Dakota", "OH":"Ohio", "OK":"Oklahoma", "OR":"Oregon", "PA":"Pennsylvania", "RI":"Rhode_Island", "SC":"South_Carolina", "SD":"South_Dakota", "TN":"Tennessee", "TX":"Texas", "UT":"Utah", "VT":"Vermont", "VA":"Virginia", "WA":"Washington", "WV":"West_Virginia", "WI":"Wisconsin", "WY":"Wyoming"}, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    (rawMapData, mapDates, columnMap, _, candidateNameToPartyIDMap, regionNameToID, __, ___, isCustomMap, voteshareCutoffMargin, shouldIncludeVoteshare) => {
      // CountyElectionResultMapSource.loadMap()
      return doubleLineVoteshareFilterFunction(rawMapData, mapDates, columnMap, _, candidateNameToPartyIDMap, regionNameToID, __, ___, isCustomMap, voteshareCutoffMargin, shouldIncludeVoteshare)
    }, // organizeMapDataFunction
    null, // viewingDataFunction
    countyZoomingDataFunction, // zoomingDataFunction
    pastElectoralVoteCounts, // splitVoteDataFunction
    {showSplitVotesOnCanZoom: false, showSplitVoteBoxes: false}, // splitVoteDisplayOptions
    (regionID) => {
      if (!regionID || !regionID.includes(subregionSeparator)) { return regionID }

      let state = regionID.split(subregionSeparator)[0]
      let county = regionID.split(subregionSeparator)[1].replace(/_s$/, "'s").replaceAll("_", " ")

      return county + ", " + state
    }, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage)
    {
      if (mapDate == null) { return }

      if (regionID && regionID.includes(subregionSeparator))
      {
        regionID = regionID.split(subregionSeparator)[0]
      }

      var linkToOpen = homepageURL + mapDate.getFullYear() + "_United_States_presidential_election"
      if (!shouldOpenHomepage)
      {
        linkToOpen += "_in_" + regionIDToLinkMap[regionID]
      }
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0, // voteshareCutoffMargin
    getPresidentialSVGFromDate, // overrideSVGPath
    null, // shouldSetDisabledWorthToZero
    null, // shouldUseOriginalMapDataForTotalsPieChart
    true // shouldForcePopularVoteDisplayOnZoom
  )

  var HistoricalElectionResultMapSource = new MapSource(
    "Historical-Presidential-Elections", // id
    "Older Elections", // name
    "./csv-sources/historical-president.csv", // dataURL
    "https://en.wikipedia.org/wiki/", // homepageURL
    "./assets/wikipedia-large.png", // iconURL
    {
      date: "date",
      region: "region",
      percentAdjusted: "voteshare",
      electoralVotes: "ev",
      partyCandidateName: "candidate",
      partyID: "party",
      candidateName: "candidate"
    }, // columnMap
    null, // cycleYear
    electionYearToCandidateData, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    {"AL":"Alabama", "AK":"Alaska", "AZ":"Arizona", "AR":"Arkansas", "CA":"California", "CO":"Colorado", "CT":"Connecticut", "DE":"Delaware", "DC":"the_District_of_Columbia", "FL":"Florida", "GA":"Georgia", "HI":"Hawaii", "ID":"Idaho", "IL":"Illinois", "IN":"Indiana", "IA":"Iowa", "KS":"Kansas", "KY":"Kentucky", "LA":"Louisiana", "ME-D1":"Maine", "ME-D2":"Maine", "ME-AL":"Maine", "ME":"Maine", "MD":"Maryland", "MA":"Massachusetts", "MI":"Michigan", "MN":"Minnesota", "MS":"Mississippi", "MO":"Missouri", "MT":"Montana", "NE-D1":"Nebraska", "NE-D2":"Nebraska", "NE-D3":"Nebraska", "NE-AL":"Nebraska", "NE":"Nebraska", "NV":"Nevada", "NH":"New_Hampshire", "NJ":"New_Jersey", "NM":"New_Mexico", "NY":"New_York", "NC":"North_Carolina", "ND":"North_Dakota", "OH":"Ohio", "OK":"Oklahoma", "OR":"Oregon", "PA":"Pennsylvania", "RI":"Rhode_Island", "SC":"South_Carolina", "SD":"South_Dakota", "TN":"Tennessee", "TX":"Texas", "UT":"Utah", "VT":"Vermont", "VA":"Virginia", "WA":"Washington", "WV":"West_Virginia", "WI":"Wisconsin", "WY":"Wyoming"}, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    async (mapDateData) => {
      if (new Date(getCurrentDateOrToday()).getFullYear() >= 1824)
      {
        return mapDateData
      }
      else
      {
        currentViewingState = ViewingState.splitVote
        return await pastElectoralVoteCounts(mapDateData)
      }
    }, // viewingDataFunction
    null, // zoomingDataFunction
    pastElectoralVoteCounts, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage)
    {
      if (mapDate == null) { return }

      var linkToOpen = homepageURL + mapDate.getFullYear() + "_United_States_presidential_election"
      if (!shouldOpenHomepage)
      {
        linkToOpen += "_in_" + regionIDToLinkMap[regionID]
      }
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0, // voteshareCutoffMargin
    getPresidentialSVGFromDate, // overrideSVGPath
    true // shouldSetDisabledWorthToZero
  )

  var CountyElectionResultMapSource = new MapSource(
    "Presidential-Counties", // id
    "County Results", // name
    "./csv-sources/past-president-county.csv", // dataURL
    "https://en.wikipedia.org/wiki/", // homepageURL
    "./assets/wikipedia-large.png", // iconURL
    {
      date: "date",
      region: "state",
      candidateVotes: "candidatevotes",
      totalVotes: "totalvotes",
      partyID: "party",
      candidateName: "candidate",
      county: "county"
    }, // columnMap
    null, // cycleYear
    electionYearToCandidateData, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDCounty, // regionNameToIDMap
    {"AL":"Alabama", "AK":"Alaska", "AZ":"Arizona", "AR":"Arkansas", "CA":"California", "CO":"Colorado", "CT":"Connecticut", "DE":"Delaware", "DC":"the_District_of_Columbia", "FL":"Florida", "GA":"Georgia", "HI":"Hawaii", "ID":"Idaho", "IL":"Illinois", "IN":"Indiana", "IA":"Iowa", "KS":"Kansas", "KY":"Kentucky", "LA":"Louisiana", "ME-D1":"Maine", "ME-D2":"Maine", "ME-AL":"Maine", "MD":"Maryland", "MA":"Massachusetts", "MI":"Michigan", "MN":"Minnesota", "MS":"Mississippi", "MO":"Missouri", "MT":"Montana", "NE-D1":"Nebraska", "NE-D2":"Nebraska", "NE-D3":"Nebraska", "NE-AL":"Nebraska", "NV":"Nevada", "NH":"New_Hampshire", "NJ":"New_Jersey", "NM":"New_Mexico", "NY":"New_York", "NC":"North_Carolina", "ND":"North_Dakota", "OH":"Ohio", "OK":"Oklahoma", "OR":"Oregon", "PA":"Pennsylvania", "RI":"Rhode_Island", "SC":"South_Carolina", "SD":"South_Dakota", "TN":"Tennessee", "TX":"Texas", "UT":"Utah", "VT":"Vermont", "VA":"Virginia", "WA":"Washington", "WV":"West_Virginia", "WI":"Wisconsin", "WY":"Wyoming"}, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    countyVoteshareFilterFunction, // organizeMapDataFunction
    (mapDateData) => {
      var usedFallbackMap = USAHouseMapType.getSVGPath()[2] || false
      if (currentMapType.getMapSettingValue("showAllDistricts") && !usedFallbackMap)
      {
        return mapDateData
      }

      var countiesPerStateMapData = {}

      for (let regionID in mapDateData)
      {
        if (regionID.endsWith(subregionSeparator + statePopularVoteDistrictID)) { continue }

        var regionData = mapDateData[regionID]

        if (!(regionData.state in countiesPerStateMapData))
        {
          countiesPerStateMapData[regionData.state] = {region: regionData.state, voteSplits: []}
        }

        var partyVoteSplitData = countiesPerStateMapData[regionData.state].voteSplits
        var partyVote = partyVoteSplitData.find(partyVoteItem => partyVoteItem.partyID == regionData.partyID)
        if (!partyVote)
        {
          partyVote = {partyID: regionData.partyID, candidate: politicalParties[regionData.partyID].getNames()[0], votes: 0}
          partyVoteSplitData.push(partyVote)
        }
        partyVote.votes++

        if (regionData.flip)
        {
          countiesPerStateMapData[regionData.state].flip = true
        }
      }

      for (let regionID in countiesPerStateMapData)
      {
        var partyVoteSplitData = countiesPerStateMapData[regionID].voteSplits
        partyVoteSplitData.sort((partyVote1, partyVote2) => partyVote2.votes-partyVote1.votes)

        var largestPartyCount = partyVoteSplitData[0].votes
        var largestPartyID = partyVoteSplitData[0].partyID
        var secondLargestPartyCount = partyVoteSplitData[1] ? partyVoteSplitData[1].votes : 0

        countiesPerStateMapData[regionID].margin = (largestPartyCount/(largestPartyCount+secondLargestPartyCount)*100-50)*0.9001 // +0.001 to account for rounding errors
        countiesPerStateMapData[regionID].partyID = largestPartyID
      }

      if (mapDateData["NPV"])
      {
        countiesPerStateMapData["NPV"] = cloneObject(mapDateData["NPV"])
      }

      return countiesPerStateMapData
    }, // viewingDataFunction
    countyZoomingDataFunction, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    (regionID) => {
      if (!regionID.includes(subregionSeparator)) { return regionID }

      let state = regionID.split(subregionSeparator)[0]
      let county = regionID.split(subregionSeparator)[1].replace(/_s$/, "'s").replaceAll("_", " ")

      return county + ", " + state
    }, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage)
    {
      if (mapDate == null || !regionID.includes(subregionSeparator)) { return }

      var linkToOpen = homepageURL + mapDate.getFullYear() + "_United_States_presidential_election"
      if (!shouldOpenHomepage)
      {
        linkToOpen += "_in_" + regionIDToLinkMap[regionID.split(subregionSeparator)[0]]
      }
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0, // voteshareCutoffMargin
    () => {
      if (currentViewingState == ViewingState.viewing)
      {
        return "svg-sources/usa-governor-map.svg"
      }

      return ["svg-sources/usa-counties-map.svg", currentMapZoomRegion]
    } // overrideSVGPath
  )

  var idsToPartyNames = {}
  var partyNamesToIDs = {}
  for (var partyNum in mainPoliticalPartyIDs)
  {
    if (mainPoliticalPartyIDs[partyNum] == TossupParty.getID()) { continue }

    partyNamesToIDs[politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]] = mainPoliticalPartyIDs[partyNum]
    idsToPartyNames[mainPoliticalPartyIDs[partyNum]] = politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]
  }

  var CustomMapSource = new MapSource(
    "Custom-Presidential", // id
    "Custom", // name
    null, // dateURL
    null, // homepageURL
    null, // iconURL
    {
      date: "date",
      region: "region",
      disabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      percentAdjusted: "percent",
      order: "order"
    }, // columnMap
    null, // cycleYear
    partyNamesToIDs, // candidateNameToPartyIDMap
    idsToPartyNames, // shortCandidateNameOverride
    regionNameToIDCustom, // regionNameToIDMap
    null, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    customMapConvertMapDataToCSVFunction, // convertMapDataRowToCSVFunction
    true, // isCustomMap
    false, // shouldClearDisabled
    null, // shouldShowVoteshare
    null, // voteshareCutoffMargin
    getPresidentialSVGFromDate, // overrideSVGPath
    true // shouldSetDisabledWorthToZero
  )

  var todayDate = new Date()
  CustomMapSource.setTextMapData("date\n" + (todayDate.getMonth()+1) + "/" + todayDate.getDate() + "/" + todayDate.getFullYear())

  var presidentialMapSources = {}
  presidentialMapSources[FiveThirtyEightPollAverageMapSource.getID()] = FiveThirtyEightPollAverageMapSource
  presidentialMapSources[FiveThirtyEightProjectionMapSource.getID()] = FiveThirtyEightProjectionMapSource
  presidentialMapSources[CookProjectionMapSource.getID()] = CookProjectionMapSource
  presidentialMapSources[PastElectionResultMapSource.getID()] = PastElectionResultMapSource
  presidentialMapSources[HistoricalElectionResultMapSource.getID()] = HistoricalElectionResultMapSource
  presidentialMapSources[CountyElectionResultMapSource.getID()] = CountyElectionResultMapSource
  presidentialMapSources[CustomMapSource.getID()] = CustomMapSource

  var presidentialMapSourceIDs = [FiveThirtyEightPollAverageMapSource.getID(), FiveThirtyEightProjectionMapSource.getID(), CookProjectionMapSource.getID(), PastElectionResultMapSource.getID(), HistoricalElectionResultMapSource.getID()]
  if (USAPresidentialMapType.getCustomMapEnabled())
  {
    presidentialMapSourceIDs.push(CustomMapSource.getID())
  }

  const kPastElectionsVsPastElections = 1
  const kPastElectionsVs538Projection = 2
  const kPastElectionsVs538PollAvg = 3

  var defaultPresidentialCompareSourceIDs = {}
  defaultPresidentialCompareSourceIDs[kPastElectionsVsPastElections] = [PastElectionResultMapSource.getID(), PastElectionResultMapSource.getID()]
  defaultPresidentialCompareSourceIDs[kPastElectionsVs538Projection] = [PastElectionResultMapSource.getID(), FiveThirtyEightProjectionMapSource.getID()]
  defaultPresidentialCompareSourceIDs[kPastElectionsVs538PollAvg] = [PastElectionResultMapSource.getID(), FiveThirtyEightPollAverageMapSource.getID()]

  USAPresidentialMapType.setMapSources(presidentialMapSources)
  USAPresidentialMapType.setMapSourceIDs(presidentialMapSourceIDs)
  USAPresidentialMapType.setDefaultCompareSourceIDs(defaultPresidentialCompareSourceIDs)
  USAPresidentialMapType.setCustomSourceID(CustomMapSource.getID())
}

function createSenateMapSources()
{
  const regionNameToIDHistorical = {"Alabama":"AL", "Alaska":"AK", "Arizona":"AZ", "Arkansas":"AR", "California":"CA", "Colorado":"CO", "Connecticut":"CT", "Delaware":"DE", "Florida":"FL", "Georgia":"GA", "Hawaii":"HI", "Idaho":"ID", "Illinois":"IL", "Indiana":"IN", "Iowa":"IA", "Kansas":"KS", "Kentucky":"KY", "Louisiana":"LA", "Maine":"ME", "Maryland":"MD", "Massachusetts":"MA", "Michigan":"MI", "Minnesota":"MN", "Mississippi":"MS", "Missouri":"MO", "Montana":"MT", "Nebraska":"NE", "Nevada":"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", "Ohio":"OH", "Oklahoma":"OK", "Oregon":"OR", "Pennsylvania":"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", "Tennessee":"TN", "Texas":"TX", "Utah":"UT", "Vermont":"VT", "Virginia":"VA", "Washington":"WA", "West Virginia":"WV", "Wisconsin":"WI", "Wyoming":"WY", "National Popular Vote":"NPV"}

  const stateClasses = {
    /* Class 1/2 */ "MT": [1, 2], "WY": [1, 2], "NM": [1, 2], "NE": [1, 2], "TX": [1, 2], "MN": [1, 2], "MI": [1, 2], "TN": [1, 2], "MS": [1, 2], "WV": [1, 2], "VA": [1, 2], "DE": [1, 2], "NJ": [1, 2], "MA": [1, 2], "RI": [1, 2], "ME": [1, 2],
    /* Class 1/3 */ "HI": [1, 3], "CA": [1, 3], "WA": [1, 3], "NV": [1, 3], "UT": [1, 3], "AZ": [1, 3], "ND": [1, 3], "MO": [1, 3], "WI": [1, 3], "IN": [1, 3], "OH": [1, 3], "FL": [1, 3], "PA": [1, 3], "MD": [1, 3], "NY": [1, 3], "CT": [1, 3], "VT": [1, 3],
    /* Class 2/3 */ "AK": [2, 3], "OR": [2, 3], "ID": [2, 3], "CO": [2, 3], "SD": [2, 3], "KS": [2, 3], "OK": [2, 3], "IA": [2, 3], "AR": [2, 3], "LA": [2, 3], "IL": [2, 3], "KY": [2, 3], "AL": [2, 3], "GA": [2, 3], "SC": [2, 3], "NC": [2, 3], "NH": [2, 3],
    /* National Popular Vote */ "NPV": [1]
  }

  const heldSeatPartyIDs2022 = {"AK-2": republicanPartyID, "HI-1": democraticPartyID, "AL-2": republicanPartyID, "AR-2": republicanPartyID, "AZ-1": democraticPartyID, "CA-1": democraticPartyID, "CO-2": democraticPartyID, "CT-1": democraticPartyID, "DE-2": democraticPartyID, "FL-1": republicanPartyID, "GA-2": democraticPartyID, "IA-2": republicanPartyID, "ID-2": republicanPartyID, "IL-2": democraticPartyID, "IN-1": republicanPartyID, "KS-2": republicanPartyID, "KY-2": republicanPartyID, "LA-2": republicanPartyID, "MA-2": democraticPartyID, "MD-1": democraticPartyID, "ME-2": republicanPartyID, "MI-2": democraticPartyID, "MN-2": democraticPartyID, "MO-1": republicanPartyID, "MS-2": republicanPartyID, "MT-2": republicanPartyID, "NC-2": republicanPartyID, "ND-1": republicanPartyID, "NH-2": democraticPartyID, "NJ-2": democraticPartyID, "NM-2": democraticPartyID, "NV-1": democraticPartyID, "NY-1": democraticPartyID, "OH-1": democraticPartyID, "OK-2": republicanPartyID, "OR-2": democraticPartyID, "PA-1": democraticPartyID, "RI-2": democraticPartyID, "SC-2": republicanPartyID, "SD-2": republicanPartyID, "TN-2": republicanPartyID, "TX-2": republicanPartyID, "UT-1": republicanPartyID, "VA-2": democraticPartyID, "VT-1": democraticPartyID, "WA-1": democraticPartyID, "WI-1": democraticPartyID, "WV-2": republicanPartyID, "WY-2": republicanPartyID, "NE-2": republicanPartyID, "WA-3": democraticPartyID, "OR-3": democraticPartyID, "CA-3": democraticPartyID, "NV-3": democraticPartyID, "UT-3": republicanPartyID, "AZ-3": democraticPartyID, "NM-1": democraticPartyID, "AK-3": republicanPartyID, "HI-3": democraticPartyID, "TX-1": republicanPartyID, "OK-3": republicanPartyID, "KS-3": republicanPartyID, "CO-3": democraticPartyID, "NE-1": republicanPartyID, "WY-1": republicanPartyID, "MT-1": democraticPartyID, "ID-3": republicanPartyID, "ND-3": republicanPartyID, "SD-3": republicanPartyID, "MN-1": democraticPartyID, "WI-3": republicanPartyID, "IA-3": republicanPartyID, "IL-3": democraticPartyID, "MO-3": republicanPartyID, "AR-3": republicanPartyID, "LA-3": republicanPartyID, "MS-1": republicanPartyID, "AL-3": republicanPartyID, "GA-3": democraticPartyID, "FL-3": republicanPartyID, "SC-3": republicanPartyID, "NC-3": republicanPartyID, "TN-1": republicanPartyID, "KY-3": republicanPartyID, "WV-1": democraticPartyID, "VA-1": democraticPartyID, "OH-3": republicanPartyID, "IN-3": republicanPartyID, "MI-1": democraticPartyID, "PA-3": republicanPartyID, "NY-3": democraticPartyID, "ME-1": democraticPartyID, "NH-3": democraticPartyID, "VT-3": democraticPartyID, "MA-1": democraticPartyID, "RI-1": democraticPartyID, "CT-3": democraticPartyID, "NJ-1": democraticPartyID, "DE-1": democraticPartyID, "MD-3": democraticPartyID, "NPV-1": republicanPartyID}

  var singleLineVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, cycleYear, _, regionNameToID, heldRegionMap, ___, ____, voteshareCutoffMargin)
  {
    let mapData = {}
    let partyNameData = {}

    const deluxeProjectionType = "_deluxe"
    const candidateColumns = {[DemocraticParty.getID()]: ["D1", "D2", "D3", "D4"], [RepublicanParty.getID()]: ["R1", "R2", "R3", "R4"], [IndependentGenericParty.getID()]: ["I1", "O1"]}
    const candidateNameColumnPrefix = "name_"
    const candidateVoteshareColumnPrefix = "voteshare_mean_"
    const candidateWinColumnPrefix = "winner_"

    let onCycleClass = ((cycleYear-2)%6)/2+1
    let partyNames = Object.keys(candidateColumns).map(partyID => politicalParties[partyID].getNames()[0])

    for (let mapDate of mapDates)
    {
      let rawDateData = rawMapData[mapDate].filter(mapRow => mapRow[columnMap.pollType] == deluxeProjectionType)
      let dateData = {}

      for (let mapRow of rawDateData)
      {
        let [_, regionID, regionClass] = /(\w\w)-S(\d)/.exec(mapRow[columnMap.region])

        let shouldBeSpecialRegion = regionClass != onCycleClass
        let candidateArray = []

        for (let partyID in candidateColumns)
        {
          for (let candidateID of candidateColumns[partyID])
          {
            let candidateName = mapRow[candidateNameColumnPrefix + candidateID]
            if (candidateName == "") break

            let candidateLastName = capitalize(candidateName.replaceAll(",", "").replaceAll(/ III?$/g, "").replaceAll(/ Jr\.?/g, "").replaceAll(/ Sr\.?/g, "").split(" ").reverse()[0])

            candidateArray.push({candidate: candidateLastName, partyID: partyID, voteshare: parseFloat(mapRow[candidateVoteshareColumnPrefix + candidateID]), winPercentage: parseFloat(mapRow[candidateWinColumnPrefix + candidateID])*100})
          }
        }

        let voteshareSortedCandidateData = candidateArray.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
        voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)

        if (voteshareSortedCandidateData.length == 0)
        {
          console.log("No candidate data!", new Date(mapDate).getFullYear().toString(), regionID)
          continue
        }

        let greatestMarginPartyID
        let greatestMarginCandidateName
        let topTwoMargin

        if (voteshareSortedCandidateData[0].voteshare != 0)
        {
          greatestMarginPartyID = voteshareSortedCandidateData[0].partyID
          greatestMarginCandidateName = voteshareSortedCandidateData[0].candidate
          topTwoMargin = voteshareSortedCandidateData[0].voteshare - (voteshareSortedCandidateData[1] ? voteshareSortedCandidateData[1].voteshare : 0)
        }
        else
        {
          greatestMarginPartyID = TossupParty.getID()
          greatestMarginCandidateName = null
          topTwoMargin = 0
        }

        let partyIDToCandidateNames = {}
        for (let candidateData of voteshareSortedCandidateData)
        {
          partyIDToCandidateNames[candidateData.partyID] = candidateData.candidate
        }

        dateData[regionID + (shouldBeSpecialRegion ? "-S" : "")] = {region: regionID + (shouldBeSpecialRegion ? "-S" : ""), seatClass: regionClass, offYear: false, runoff: false, isSpecial: shouldBeSpecialRegion, margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: voteshareSortedCandidateData, flip: heldRegionMap[regionID + "-" + regionClass] != greatestMarginPartyID}
      }

      for (let regionID of Object.values(regionNameToID))
      {
        if (regionID == nationalPopularVoteID) continue

        let placeholderRegionData = {offYear: false, runoff: false, margin: 101, disabled: true}

        let seatClassesToUse = [stateClasses[regionID][0] != onCycleClass ? stateClasses[regionID][0] : stateClasses[regionID][1], stateClasses[regionID][1] != onCycleClass ? stateClasses[regionID][1] : stateClasses[regionID][0]]

        if (!dateData[regionID])
        {
          dateData[regionID] = {region: regionID, seatClass: seatClassesToUse[0], isSpecial: false, partyID: heldRegionMap[regionID + "-" + seatClassesToUse[0]], ...placeholderRegionData}
        }
        if (!dateData[regionID + "-S"])
        {
          dateData[regionID + "-S"] = {region: regionID + "-S", seatClass: seatClassesToUse[1], isSpecial: true, partyID: heldRegionMap[regionID + "-" + seatClassesToUse[1]], ...placeholderRegionData}
        }
      }

      mapData[mapDate] = dateData
      partyNameData[mapDate] = partyNames
    }

    return {mapData: mapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  var doubleLineClassSeparatedFilterFunction = function(rawMapData, mapDates, columnMap, _, candidateNameToPartyIDMap, regionNameToID, heldRegionMap, ____, isCustomMap, voteshareCutoffMargin, shouldIncludeVoteshare)
  {
    var filteredMapData = {}
    var partyNameData = {}

    var regionNames = Object.keys(regionNameToID)
    var regionIDs = Object.values(regionNameToID)

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var currentMapDate = new Date(mapDates[dateNum])
      var currentDatePartyNameArray = {}

      var isOffyear = rawDateData[0][columnMap.isOffyear] == "TRUE"

      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]

        for (var classNumIndex in stateClasses[regionNameToID[regionToFind]])
        {
          var classNum = stateClasses[regionNameToID[regionToFind]][classNumIndex]

          var mapDataRows = rawDateData.filter(row => {
            return row[columnMap.region] == regionToFind && row[columnMap.seatClass] == classNum
          })

          if (mapDataRows.length == 0)
          {
            if (isCustomMap)
            {
              let partyIDToCandidateNames = {}
              for (var partyCandidateName in candidateNameToPartyIDMap)
              {
                partyIDToCandidateNames[candidateNameToPartyIDMap[partyCandidateName]] = partyCandidateName
              }

              filteredDateData[regionNameToID[regionToFind] + (classNumIndex == 1 ? "-S" : "")] = {region: regionNameToID[regionToFind] + (classNumIndex == 1 ? "-S" : ""), seatClass: classNum, offYear: false, runoff: false, isSpecial: classNumIndex == 1, margin: 0, partyID: TossupParty.getID(), candidateMap: partyIDToCandidateNames}
            }
            continue
          }

          var isSpecialElection = mapDataRows[0][columnMap.isSpecial] == "TRUE"
          var shouldBeSpecialRegion = currentMapType.getMapSettings().seatArrangement == "election-type" ? isSpecialElection : (stateClasses[regionNameToID[regionToFind]].indexOf(classNum) == 1)

          var isRunoffElection = mapDataRows[0][columnMap.isRunoff] == "TRUE"

          var candidateData = {}

          for (var rowNum in mapDataRows)
          {
            var row = mapDataRows[rowNum]

            var candidateName = row[columnMap.candidateName]
            var currentVoteshare = parseFloat(row[columnMap.voteshare])*100
            var currentOrder = row[columnMap.order] ? parseInt(row[columnMap.order]) : null

            var currentPartyName = row[columnMap.partyID]
            var foundParty = Object.values(politicalParties).find(party => {
              var partyNames = cloneObject(party.getNames())
              for (var nameNum in partyNames)
              {
                partyNames[nameNum] = partyNames[nameNum].toLowerCase()
              }
              return partyNames.includes(currentPartyName)
            })

            if (!foundParty && Object.keys(politicalParties).includes(currentPartyName))
            {
              foundParty = politicalParties[currentPartyName]
            }

            var currentPartyID
            if (foundParty)
            {
              currentPartyID = foundParty.getID()
            }
            else
            {
              currentPartyID = IndependentGenericParty.getID()
            }

            if (Object.keys(candidateData).includes(candidateName))
            {
              if (currentVoteshare > candidateData[candidateName].voteshare)
              {
                candidateData[candidateName].partyID = currentPartyID
              }

              candidateData[candidateName].voteshare += currentVoteshare
            }
            else
            {
              candidateData[candidateName] = {candidate: candidateName, partyID: currentPartyID, voteshare: currentVoteshare, order: currentOrder}
            }
          }

          var voteshareSortedCandidateData = Object.values(candidateData)
          voteshareSortedCandidateData = voteshareSortedCandidateData.filter((candData) => !isNaN(candData.voteshare))
          voteshareSortedCandidateData.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
          if (!isCustomMap && voteshareCutoffMargin != null)
          {
            voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)
          }

          if (voteshareSortedCandidateData.length == 0)
          {
            console.log("No candidate data!", currentMapDate.getFullYear().toString(), regionToFind)
            continue
          }

          var greatestMarginPartyID
          var greatestMarginCandidateName
          var topTwoMargin

          if (voteshareSortedCandidateData[0].voteshare != 0)
          {
            let topCandidateData = voteshareSortedCandidateData.filter(candidateData => candidateData.order == 0 || candidateData.order == 1).sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
            if (topCandidateData.length == 0)
            {
              topCandidateData = [voteshareSortedCandidateData[0]]
              if (voteshareSortedCandidateData[1])
              {
                topCandidateData.push(voteshareSortedCandidateData[1])
              }
            }

            greatestMarginPartyID = topCandidateData[0].partyID
            greatestMarginCandidateName = topCandidateData[0].candidate
            topTwoMargin = topCandidateData[0].voteshare - (topCandidateData[1] ? topCandidateData[1].voteshare : 0)
          }
          else
          {
            greatestMarginPartyID = TossupParty.getID()
            greatestMarginCandidateName = null
            topTwoMargin = 0
          }

          for (var candidateDataNum in voteshareSortedCandidateData)
          {
            var mainPartyID = voteshareSortedCandidateData[candidateDataNum].partyID
            currentDatePartyNameArray[mainPartyID] = politicalParties[mainPartyID].getNames()[0]
          }

          var partyIDToCandidateNames = {}
          for (let partyCandidateName in candidateData)
          {
            partyIDToCandidateNames[candidateData[partyCandidateName].partyID] = partyCandidateName
          }

          var mostRecentParty = heldRegionMap ? heldRegionMap[regionNameToID[regionToFind] + "-" + classNum] : mostRecentWinner(filteredMapData, currentMapDate.getTime(), regionNameToID[regionToFind], classNum, isRunoffElection)
          filteredDateData[regionNameToID[regionToFind] + (shouldBeSpecialRegion ? "-S" : "")] = {region: regionNameToID[regionToFind] + (shouldBeSpecialRegion ? "-S" : ""), seatClass: classNum, offYear: isOffyear, runoff: isRunoffElection, isSpecial: isSpecialElection, disabled: mapDataRows[0][columnMap.isDisabled] == "TRUE", margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: shouldIncludeVoteshare ? voteshareSortedCandidateData : null, flip: mostRecentParty != greatestMarginPartyID && mostRecentParty != TossupParty.getID()}
        }
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
      partyNameData[mapDates[dateNum]] = currentDatePartyNameArray
    }

    var fullFilteredMapData = cloneObject(filteredMapData)
    for (var mapDate in fullFilteredMapData)
    {
      let filteredDateData = fullFilteredMapData[mapDate]

      if (Object.values(filteredDateData).length == 0) { continue }

      let isOffyear = Object.values(filteredDateData)[0].offYear
      var isRunoff = Object.values(filteredDateData)[0].isRunoff

      var regionIDsInFilteredDateData = Object.keys(filteredDateData)
      for (let regionNum in regionIDs)
      {
        if (regionIDs[regionNum] == nationalPopularVoteID) { continue }

        if (!regionIDsInFilteredDateData.includes(regionIDs[regionNum]))
        {
          var seatIndexToUse
          if (currentMapType.getMapSettings().seatArrangement == "seat-class" || !regionIDsInFilteredDateData.includes(regionIDs[regionNum] + "-S"))
          {
            seatIndexToUse = 0
          }
          else
          {
            var usedSeatClass = filteredDateData[regionIDs[regionNum] + "-S"].seatClass
            var seatIndex = stateClasses[regionIDs[regionNum]].indexOf(usedSeatClass)
            seatIndexToUse = Math.abs(seatIndex-1)
          }
          filteredDateData[regionIDs[regionNum]] = {region: regionIDs[regionNum], margin: 101, partyID: mostRecentWinner(filteredMapData, mapDate, regionIDs[regionNum], stateClasses[regionIDs[regionNum]][seatIndexToUse]), disabled: true, offYear: isOffyear, runoff: isRunoff, seatClass: stateClasses[regionIDs[regionNum]][seatIndexToUse]}
        }
        if (!regionIDsInFilteredDateData.includes(regionIDs[regionNum] + "-S"))
        {
          let seatIndexToUse
          if (currentMapType.getMapSettings().seatArrangement == "seat-class" || !regionIDsInFilteredDateData.includes(regionIDs[regionNum]))
          {
            seatIndexToUse = 1
          }
          else
          {
            let usedSeatClass = filteredDateData[regionIDs[regionNum]].seatClass
            let seatIndex = stateClasses[regionIDs[regionNum]].indexOf(usedSeatClass)
            seatIndexToUse = Math.abs(seatIndex-1)
          }
          filteredDateData[regionIDs[regionNum] + "-S"] = {region: regionIDs[regionNum] + "-S", margin: 101, partyID: mostRecentWinner(filteredMapData, mapDate, regionIDs[regionNum], stateClasses[regionIDs[regionNum]][seatIndexToUse]), disabled: true, offYear: isOffyear, runoff: isRunoff, seatClass: stateClasses[regionIDs[regionNum]][seatIndexToUse]}
        }
      }

      fullFilteredMapData[mapDate] = filteredDateData
    }

    if (!currentMapType.getMapSettingValue("offYear"))
    {
      var filteredMapDates = []
      for (mapDate in fullFilteredMapData)
      {
        if (Object.values(fullFilteredMapData[mapDate]).length == 0) { continue }

        var offYear = Object.values(fullFilteredMapData[mapDate])[0].offYear
        var runoff = Object.values(fullFilteredMapData[mapDate])[0].runoff

        if (!offYear && !runoff)
        {
          filteredMapDates.push(parseInt(mapDate))
        }
        if (runoff)
        {
          for (var regionID in fullFilteredMapData[mapDate])
          {
            if (fullFilteredMapData[mapDate][regionID].runoff)
            {
              fullFilteredMapData[filteredMapDates[filteredMapDates.length-1]][regionID] = fullFilteredMapData[mapDate][regionID]
            }
          }
        }
      }

      mapDates = filteredMapDates
    }

    return {mapData: fullFilteredMapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  function mostRecentWinner(mapData, dateToStart, regionID, seatClass, isRunoffElection)
  {
    var reversedMapDates = cloneObject(Object.keys(mapData)).reverse()

    var startYear = (new Date(parseInt(dateToStart))).getFullYear()

    var shouldSkipNext = isRunoffElection || false // Skip first result if runoff (which should be primary)

    for (var dateNum in reversedMapDates)
    {
      if (reversedMapDates[dateNum] >= parseInt(dateToStart)) { continue }

      var currentYear = (new Date(parseInt(reversedMapDates[dateNum]))).getFullYear()

      if (startYear-currentYear > 7) // Need to include runoffs, which may take place as late as Janurary
      {
        return TossupParty.getID()
      }

      var mapDataFromDate = mapData[reversedMapDates[dateNum]]
      if (regionID in mapDataFromDate && mapDataFromDate[regionID].seatClass == seatClass)
      {
        if (shouldSkipNext)
        {
          shouldSkipNext = false
        }
        else
        {
          return mapDataFromDate[regionID].partyID
        }
      }
      else if ((regionID + "-S") in mapDataFromDate && mapDataFromDate[regionID + "-S"].seatClass == seatClass)
      {
        if (shouldSkipNext)
        {
          shouldSkipNext = false
        }
        else
        {
          return mapDataFromDate[regionID + "-S"].partyID
        }
      }
    }

    return TossupParty.getID()
  }

  function customMapConvertMapDataToCSVFunction(columnKey, mapDateString, regionID, regionNameToID, candidateName, partyID, regionData, shouldUseVoteshare)
  {
    switch (columnKey)
    {
      case "date":
      return mapDateString

      case "candidateName":
      return candidateName

      case "voteshare":
      var voteshareData = shouldUseVoteshare && regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.voteshare/100.0
      }
      else if (regionData.partyID == partyID)
      {
        return regionData.margin/100.0
      }
      return 0

      case "region":
      var trimmedRegionID = regionID.replace("-S", "")
      return getKeyByValue(regionNameToID, trimmedRegionID)

      case "seatClass":
      return regionData.seatClass

      case "partyID":
      return partyID

      case "order":
      var voteshareData = regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.order
      }
      return ""

      case "isSpecial":
      return (regionData.isSpecial || regionID.includes("-S")).toString().toUpperCase()

      case "isRunoff":
      return (regionData.runoff == null ? false : regionData.runoff).toString().toUpperCase()

      case "isOffyear":
      return (regionData.offYear == null ? false : regionData.offYear).toString().toUpperCase()

      case "isDisabled":
      return (regionData.disabled == null ? false : regionData.disabled).toString().toUpperCase()
    }
  }

  var FiveThirtyEightSenateProjectionMapSource = new MapSource(
    "538-2022-Senate-Projection", // id
    "538 Projection", // name
    "https://projects.fivethirtyeight.com/2022-general-election-forecast-data/senate_state_toplines_2022.csv", // dataURL
    "https://projects.fivethirtyeight.com/2022-election-forecast/senate/", // homepageURL
    {regular: "./assets/fivethirtyeight-large.png", mini: "./assets/fivethirtyeight.png"}, // iconURL
    {
      date: "forecastdate",
      region: "district",
      pollType: "expression"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    {"AL":"alabama", "AK":"alaska", "AZ":"arizona", "AR":"arkansas", "CA":"california", "CO":"colorado", "CT":"connecticut", "DE":"delaware", "FL":"florida", "GA":"georgia", "HI":"hawaii", "ID":"idaho", "IL":"illinois", "IN":"indiana", "IA":"iowa", "KS":"kansas", "KY":"kentucky", "LA":"louisiana", "ME":"maine", "MD":"maryland", "MA":"massachusetts", "MI":"michigan", "MN":"minnesota", "MS":"mississippi", "MO":"missouri", "MT":"montana", "NE":"nebraska", "NV":"nevada", "NH":"new-hampshire", "NJ":"new-jersey", "NM":"new-mexico", "NY":"new-york", "NC":"north-carolina", "ND":"north-dakota", "OH":"ohio", "OK":"oklahoma", "OR":"oregon", "PA":"pennsylvania", "RI":"rhode-island", "SC":"south-carolina", "SD":"south-dakota", "TN":"tennessee", "TX":"texas", "UT":"utah", "VT":"vermont", "VA":"virginia", "WA":"washington", "WV":"west-virginia", "WI":"wisconsin", "WY":"wyoming"}, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    singleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage, mapData)
    {
      if (!shouldOpenHomepage && (!mapData || !regionID || !mapDate || !mapData[mapDate.getTime()][regionID])) return

      let isSpecial = false
      if (regionID != null && mapDate != null && mapData != null)
      {
        isSpecial = mapData[mapDate.getTime()][regionID].isSpecial
      }

      let linkToOpen = homepageURL
      if (!shouldOpenHomepage)
      {
        linkToOpen += regionIDToLinkMap[regionID.replace("-S", "")] + (isSpecial ? "-special" : "")
      }

      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0 // voteshareCutoffMargin
  )

  const LTE2022SenateYouTubeIDs = {
    1608336000000: "Wk-T-lXa5-g",
    1612051200000: "yifvg3uHips",
    1614384000000: "wtYw6nmWgQ0",
    1617062400000: "TNHmvLFzD7U",
    1619827200000: "RbpHQboaeWM",
    1622851200000: "DsLq1N8YEkc",
    1625270400000: "AU_GCaD594k",
    1628294400000: "zlC6UzT2xCQ",
    1630627200000: "hY5HsIqfSyQ",
    1633132800000: "SDfCEZF1uH8",
    1635984000000: "rTEnS6Jy9oM",
    1638403200000: "skPfbpMb_g8",
    1640995200000: "BX9mEKXnBEg",
    1643673600000: "nIp2KnNLQUA",
    1646092800000: "oGzo4mVU-w8",
    1649116800000: "i58TKDsXX-Q",
    1651536000000: "a7zKYQbpt2Y",
    1652918400000: "KVLw0DhkJXA",
    1654128000000: "irPIXtfBqCc",
    1655510400000: "gVozPu2PobM",
    1656720000000: "hjJEtK5ZXw4",
    1658102400000: "gKZaNGE1dbM",
    1659830400000: "d9ij_Fh_TWU",
    1662076800000: "r0GEgtLmDk4"
  }

  var LTESenateProjectionMapSource = new MapSource(
    "LTE-2022-Senate-Projection", // id
    "LTE Projection", // name
    "./csv-sources/lte-2022-senate.csv", // dataURL
    "https://www.youtube.com/watch?v=", // homepageURL
    {regular: "./assets/lte-large.png", mini: "./assets/lte.png"}, // iconURL
    {
      date: "date",
      region: "region",
      seatClass: "class",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    doubleLineClassSeparatedFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, _, __, mapDate, ___, ____)
    {
      if (mapDate == null) { return }

      var linkToOpen = homepageURL
      linkToOpen += LTE2022SenateYouTubeIDs[mapDate.getUTCAdjustedTime()]
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    false // shouldShowVoteshare
  )

  const PA2022SenateYouTubeIDs = {
    1614211200000: "Tbsy6XZ_e-Q",
    1615420800000: "xGtBqaMiAU4",
    1616716800000: "KJtDSRW3I7Q",
    1617753600000: "_cZ8OvgwN18",
    1619136000000: "_nWQxmYO2iA",
    1628985600000: "eZGs7_uZ1YM",
    1633824000000: "R9WqiO-j2lY",
    1636156800000: "kAsztlIJm64",
    1639267200000: "Elasgd8mVLE",
    1644624000000: "njSkvysshes",
    1646524800000: "QU_mIwNflqI",
    1651190400000: "D3j334-rfNE"
  }

  var PASenateProjectionMapSource = new MapSource(
    "PA-2022-Senate-Projection", // id
    "PA Projection", // name
    "./csv-sources/pa-2022-senate.csv", // dataURL
    "https://www.youtube.com/watch?v=", // homepageURL
    {regular: "./assets/pa.png", mini: "./assets/pa.png"}, // iconURL
    {
      date: "date",
      region: "region",
      seatClass: "class",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    doubleLineClassSeparatedFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, _, __, mapDate, ___, ____)
    {
      if (mapDate == null) { return }

      var linkToOpen = homepageURL
      linkToOpen += PA2022SenateYouTubeIDs[mapDate.getUTCAdjustedTime()]
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    false // shouldShowVoteshare
  )

  const Cook2022SenateRatingIDs = {
    1610582400000: "231206",
    1611532800000: "231216",
    1626393600000: "231871",
    1637280000000: "236591",
    1645747200000: "252446",
    1646352000000: ""
  }

  var CookSenateProjectionMapSource = new MapSource(
    "Cook-2022-Senate", // id
    "Cook Political", // name
    "./csv-sources/cook-senate-2022/cook-latest.csv", // dataURL
    "https://cookpolitical.com/ratings/senate-race-ratings/", // homepageURL
    {regular: "./assets/cookpolitical-large.png", mini: "./assets/cookpolitical.png"}, // iconURL
    {
      date: "date",
      region: "region",
      seatClass: "class",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    doubleLineClassSeparatedFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, _, __, mapDate, ____)
    {
      if (mapDate == null) { return }
      window.open(homepageURL + (Cook2022SenateRatingIDs[mapDate.getUTCAdjustedTime()] || ""))
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    false // shouldShowVoteshare
  )

  var SCBSenateProjectionMapSource = new MapSource(
    "SCB-2022-Senate", // id
    "Sabato's CB", // name
    "./csv-sources/scb-2022-senate.csv", // dataURL
    "https://centerforpolitics.org/crystalball/2022-senate/", // homepageURL
    {regular: "./assets/scb.png", mini: "./assets/scb.png"}, // iconURL
    {
      date: "date",
      region: "region",
      seatClass: "class",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    doubleLineClassSeparatedFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    false // shouldShowVoteshare
  )

  var PastElectionResultMapSource = new MapSource(
    "Past-Senate-Elections", // id
    "Past Elections", // name
    "./csv-sources/past-senate.csv", // dataURL
    "https://en.wikipedia.org/wiki/", // homepageURL
    "./assets/wikipedia-large.png", // iconURL
    {
      date: "date",
      region: "region",
      seatClass: "class",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    null, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    {"AL":"Alabama", "AK":"Alaska", "AZ":"Arizona", "AR":"Arkansas", "CA":"California", "CO":"Colorado", "CT":"Connecticut", "DE":"Delaware", "FL":"Florida", "GA":"Georgia", "HI":"Hawaii", "ID":"Idaho", "IL":"Illinois", "IN":"Indiana", "IA":"Iowa", "KS":"Kansas", "KY":"Kentucky", "LA":"Louisiana", "ME":"Maine", "MD":"Maryland", "MA":"Massachusetts", "MI":"Michigan", "MN":"Minnesota", "MS":"Mississippi", "MO":"Missouri", "MT":"Montana", "NE":"Nebraska", "NV":"Nevada", "NH":"New_Hampshire", "NJ":"New_Jersey", "NM":"New_Mexico", "NY":"New_York", "NC":"North_Carolina", "ND":"North_Dakota", "OH":"Ohio", "OK":"Oklahoma", "OR":"Oregon", "PA":"Pennsylvania", "RI":"Rhode_Island", "SC":"South_Carolina", "SD":"South_Dakota", "TN":"Tennessee", "TX":"Texas", "UT":"Utah", "VT":"Vermont", "VA":"Virginia", "WA":"Washington", "WV":"West_Virginia", "WI":"Wisconsin", "WY":"Wyoming"}, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineClassSeparatedFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage, mapData)
    {
      if (mapDate == null) { return }

      var isSpecial = false
      if (regionID != null && mapDate != null)
      {
        isSpecial = mapData[mapDate.getTime()][regionID].isSpecial
      }

      var linkToOpen = homepageURL + mapDate.getFullYear() + "_United_States_Senate_"
      if (!shouldOpenHomepage)
      {
        var baseRegionID = regionID
        if (isSpecial)
        {
          linkToOpen += "special_"
        }
        if (regionID.endsWith("-S"))
        {
          baseRegionID = regionID.slice(0, regionID.length-2)
        }
        linkToOpen += "election"
        linkToOpen += "_in_" + regionIDToLinkMap[baseRegionID]
      }
      else
      {
        linkToOpen += "election"
      }
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0 // voteshareCutoffMargin
  )

  var idsToPartyNames = {}
  var partyNamesToIDs = {}
  for (var partyNum in mainPoliticalPartyIDs)
  {
    if (mainPoliticalPartyIDs[partyNum] == TossupParty.getID()) { continue }

    partyNamesToIDs[politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]] = mainPoliticalPartyIDs[partyNum]
    idsToPartyNames[mainPoliticalPartyIDs[partyNum]] = politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]
  }

  var CustomMapSource = new MapSource(
    "Custom-Senate", // id
    "Custom", // name
    null, // dataURL
    null, // homepageURL
    null, // iconURL
    {
      date: "date",
      region: "region",
      seatClass: "class",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare",
      order: "order"
    }, // columnMap
    null, // cycleYear
    partyNamesToIDs, // candidateNameToPartyIDMap
    idsToPartyNames, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineClassSeparatedFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    customMapConvertMapDataToCSVFunction, // convertMapDataRowToCSVFunction
    true, // isCustomMap
    false, // shouldClearDisabled
    null // shouldShowVoteshare
  )

  var todayDate = new Date()
  CustomMapSource.setTextMapData("date\n" + (todayDate.getMonth()+1) + "/" + todayDate.getDate() + "/" + todayDate.getFullYear())

  var senateMapSources = {}
  senateMapSources[FiveThirtyEightSenateProjectionMapSource.getID()] = FiveThirtyEightSenateProjectionMapSource
  senateMapSources[LTESenateProjectionMapSource.getID()] = LTESenateProjectionMapSource
  senateMapSources[PASenateProjectionMapSource.getID()] = PASenateProjectionMapSource
  senateMapSources[CookSenateProjectionMapSource.getID()] = CookSenateProjectionMapSource
  senateMapSources[SCBSenateProjectionMapSource.getID()] = SCBSenateProjectionMapSource
  senateMapSources[PastElectionResultMapSource.getID()] = PastElectionResultMapSource
  senateMapSources[CustomMapSource.getID()] = CustomMapSource

  var senateMapSourceIDs = [FiveThirtyEightSenateProjectionMapSource.getID(), LTESenateProjectionMapSource.getID(), PASenateProjectionMapSource.getID(), CookSenateProjectionMapSource.getID(), SCBSenateProjectionMapSource.getID(), PastElectionResultMapSource.getID()]
  if (USASenateMapType.getCustomMapEnabled())
  {
    senateMapSourceIDs.push(CustomMapSource.getID())
  }

  const kPastElectionsVsPastElections = 1

  var defaultSenateCompareSourceIDs = {}
  defaultSenateCompareSourceIDs[kPastElectionsVsPastElections] = [PastElectionResultMapSource.getID(), PastElectionResultMapSource.getID()]

  USASenateMapType.setMapSources(senateMapSources)
  USASenateMapType.setMapSourceIDs(senateMapSourceIDs)
  USASenateMapType.setDefaultCompareSourceIDs(defaultSenateCompareSourceIDs)
  USASenateMapType.setCustomSourceID(CustomMapSource.getID())
}

function createGovernorMapSources()
{
  const regionNameToIDHistorical = {"Alabama":"AL", "Alaska":"AK", "Arizona":"AZ", "Arkansas":"AR", "California":"CA", "Colorado":"CO", "Connecticut":"CT", "Delaware":"DE", "Florida":"FL", "Georgia":"GA", "Hawaii":"HI", "Idaho":"ID", "Illinois":"IL", "Indiana":"IN", "Iowa":"IA", "Kansas":"KS", "Kentucky":"KY", "Louisiana":"LA", "Maine":"ME", "Maryland":"MD", "Massachusetts":"MA", "Michigan":"MI", "Minnesota":"MN", "Mississippi":"MS", "Missouri":"MO", "Montana":"MT", "Nebraska":"NE", "Nevada":"NV", "New Hampshire":"NH", "New Jersey":"NJ", "New Mexico":"NM", "New York":"NY", "North Carolina":"NC", "North Dakota":"ND", "Ohio":"OH", "Oklahoma":"OK", "Oregon":"OR", "Pennsylvania":"PA", "Rhode Island":"RI", "South Carolina":"SC", "South Dakota":"SD", "Tennessee":"TN", "Texas":"TX", "Utah":"UT", "Vermont":"VT", "Virginia":"VA", "Washington":"WA", "West Virginia":"WV", "Wisconsin":"WI", "Wyoming":"WY", "National Popular Vote":"NPV"}

  const heldSeatPartyIDs2022 = {"AK": republicanPartyID, "HI": democraticPartyID, "AL": republicanPartyID, "AR": republicanPartyID, "AZ": republicanPartyID, "CA": democraticPartyID, "CO": democraticPartyID, "CT": democraticPartyID, "DE": democraticPartyID, "FL": republicanPartyID, "GA": republicanPartyID, "IA": republicanPartyID, "ID": republicanPartyID, "IL": democraticPartyID, "IN": republicanPartyID, "KS": democraticPartyID, "KY": democraticPartyID, "LA": democraticPartyID, "MA": republicanPartyID, "MD": republicanPartyID, "ME": democraticPartyID, "MI": democraticPartyID, "MN": democraticPartyID, "MO": republicanPartyID, "MS": republicanPartyID, "MT": republicanPartyID, "NC": democraticPartyID, "ND": republicanPartyID, "NH": republicanPartyID, "NJ": democraticPartyID, "NM": democraticPartyID, "NV": democraticPartyID, "NY": democraticPartyID, "OH": republicanPartyID, "OK": republicanPartyID, "OR": democraticPartyID, "PA": democraticPartyID, "RI": democraticPartyID, "SC": republicanPartyID, "SD": republicanPartyID, "TN": republicanPartyID, "TX": republicanPartyID, "UT": republicanPartyID, "VA": republicanPartyID, "VT": republicanPartyID, "WA": democraticPartyID, "WI": democraticPartyID, "WV": republicanPartyID, "WY": republicanPartyID, "NE": republicanPartyID}

  var singleLineVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, _, __, regionNameToID, heldRegionMap, ___, ____, voteshareCutoffMargin)
  {
    let mapData = {}
    let partyNameData = {}

    const deluxeProjectionType = "_deluxe"
    const candidateColumns = {[DemocraticParty.getID()]: ["D1", "D2", "D3", "D4"], [RepublicanParty.getID()]: ["R1", "R2", "R3", "R4"], [IndependentGenericParty.getID()]: ["I1", "O1"]}
    const candidateNameColumnPrefix = "name_"
    const candidateVoteshareColumnPrefix = "voteshare_mean_"
    const candidateWinColumnPrefix = "winner_"

    let partyNames = Object.keys(candidateColumns).map(partyID => politicalParties[partyID].getNames()[0])

    for (let mapDate of mapDates)
    {
      let rawDateData = rawMapData[mapDate].filter(mapRow => mapRow[columnMap.pollType] == deluxeProjectionType)
      let dateData = {}

      for (let mapRow of rawDateData)
      {
        let [_, regionID] = /(\w\w)-G1/.exec(mapRow[columnMap.region])

        let candidateArray = []

        for (let partyID in candidateColumns)
        {
          for (let candidateID of candidateColumns[partyID])
          {
            let candidateName = mapRow[candidateNameColumnPrefix + candidateID]
            if (candidateName == "") break

            let candidateLastName = capitalize(candidateName.replaceAll(",", "").replaceAll(/ III?$/g, "").replaceAll(/ Jr\.?/g, "").replaceAll(/ Sr\.?/g, "").split(" ").reverse()[0])

            candidateArray.push({candidate: candidateLastName, partyID: partyID, voteshare: parseFloat(mapRow[candidateVoteshareColumnPrefix + candidateID]), winPercentage: parseFloat(mapRow[candidateWinColumnPrefix + candidateID])*100})
          }
        }

        let voteshareSortedCandidateData = candidateArray.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
        voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)

        if (voteshareSortedCandidateData.length == 0)
        {
          console.log("No candidate data!", new Date(mapDate).getFullYear().toString(), regionID)
          continue
        }

        let greatestMarginPartyID
        let greatestMarginCandidateName
        let topTwoMargin

        if (voteshareSortedCandidateData[0].voteshare != 0)
        {
          greatestMarginPartyID = voteshareSortedCandidateData[0].partyID
          greatestMarginCandidateName = voteshareSortedCandidateData[0].candidate
          topTwoMargin = voteshareSortedCandidateData[0].voteshare - (voteshareSortedCandidateData[1] ? voteshareSortedCandidateData[1].voteshare : 0)
        }
        else
        {
          greatestMarginPartyID = TossupParty.getID()
          greatestMarginCandidateName = null
          topTwoMargin = 0
        }

        let partyIDToCandidateNames = {}
        for (let candidateData of voteshareSortedCandidateData)
        {
          partyIDToCandidateNames[candidateData.partyID] = candidateData.candidate
        }

        dateData[regionID] = {region: regionID, offYear: false, runoff: false, isSpecial: false, margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: voteshareSortedCandidateData, flip: heldRegionMap[regionID] != greatestMarginPartyID}
      }

      for (let regionID of Object.values(regionNameToID))
      {
        if (regionID == nationalPopularVoteID) continue

        if (!dateData[regionID])
        {
          dateData[regionID] = {region: regionID, isSpecial: false, offYear: false, runoff: false, margin: 101, disabled: true, partyID: heldRegionMap[regionID]}
        }
      }

      mapData[mapDate] = dateData
      partyNameData[mapDate] = partyNames
    }

    return {mapData: mapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  var doubleLineVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, _, candidateNameToPartyIDMap, regionNameToID, heldRegionMap, ____, isCustomMap, voteshareCutoffMargin, shouldIncludeVoteshare)
  {
    var filteredMapData = {}
    var partyNameData = {}

    var regionNames = Object.keys(regionNameToID)
    var regionIDs = Object.values(regionNameToID)

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var currentMapDate = new Date(mapDates[dateNum])
      var currentDatePartyNameArray = {}

      var isOffyear = rawDateData[0][columnMap.isOffyear] == "TRUE"

      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]

        var mapDataRows = rawDateData.filter(row => {
          return row[columnMap.region] == regionToFind
        })

        if (mapDataRows.length == 0)
        {
          if (isCustomMap)
          {
            let partyIDToCandidateNames = {}
            for (var partyCandidateName in candidateNameToPartyIDMap)
            {
              partyIDToCandidateNames[candidateNameToPartyIDMap[partyCandidateName]] = partyCandidateName
            }

            filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], offYear: false, runoff: false, isSpecial: false, margin: 0, partyID: TossupParty.getID(), candidateMap: partyIDToCandidateNames}
          }
          continue
        }

        var isSpecialElection = mapDataRows[0][columnMap.isSpecial] == "TRUE"
        var isRunoffElection = mapDataRows[0][columnMap.isRunoff] == "TRUE"

        var candidateData = {}

        for (var rowNum in mapDataRows)
        {
          var row = mapDataRows[rowNum]

          var candidateName = row[columnMap.candidateName]
          var currentVoteshare = parseFloat(row[columnMap.voteshare])*100
          var currentOrder = row[columnMap.order] ? parseInt(row[columnMap.order]) : null

          var currentPartyName = row[columnMap.partyID]
          var foundParty = Object.values(politicalParties).find(party => {
            var partyNames = cloneObject(party.getNames())
            for (var nameNum in partyNames)
            {
              partyNames[nameNum] = partyNames[nameNum].toLowerCase()
            }
            return partyNames.includes(currentPartyName)
          })

          if (!foundParty && Object.keys(politicalParties).includes(currentPartyName))
          {
            foundParty = politicalParties[currentPartyName]
          }

          var currentPartyID
          if (foundParty)
          {
            currentPartyID = foundParty.getID()
          }
          else
          {
            currentPartyID = IndependentGenericParty.getID()
          }

          if (Object.keys(candidateData).includes(candidateName))
          {
            if (currentVoteshare > candidateData[candidateName].voteshare)
            {
              candidateData[candidateName].partyID = currentPartyID
            }

            candidateData[candidateName].voteshare += currentVoteshare
          }
          else
          {
            candidateData[candidateName] = {candidate: candidateName, partyID: currentPartyID, voteshare: currentVoteshare, order: currentOrder}
          }
        }

        var voteshareSortedCandidateData = Object.values(candidateData)
        voteshareSortedCandidateData = voteshareSortedCandidateData.filter((candData) => !isNaN(candData.voteshare))
        voteshareSortedCandidateData.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
        if (!isCustomMap && voteshareCutoffMargin != null)
        {
          voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)
        }

        if (voteshareSortedCandidateData.length == 0)
        {
          console.log("No candidate data!", currentMapDate.getFullYear().toString(), regionToFind)
          continue
        }

        var greatestMarginPartyID
        var greatestMarginCandidateName
        var topTwoMargin

        if (voteshareSortedCandidateData[0].voteshare != 0)
        {
          let topCandidateData = voteshareSortedCandidateData.filter(candidateData => candidateData.order == 0 || candidateData.order == 1).sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
          if (topCandidateData.length == 0)
          {
            topCandidateData = [voteshareSortedCandidateData[0]]
            if (voteshareSortedCandidateData[1])
            {
              topCandidateData.push(voteshareSortedCandidateData[1])
            }
          }

          greatestMarginPartyID = topCandidateData[0].partyID
          greatestMarginCandidateName = topCandidateData[0].candidate
          topTwoMargin = topCandidateData[0].voteshare - (topCandidateData[1] ? topCandidateData[1].voteshare : 0)
        }
        else
        {
          greatestMarginPartyID = TossupParty.getID()
          greatestMarginCandidateName = null
          topTwoMargin = 0
        }

        for (var candidateDataNum in voteshareSortedCandidateData)
        {
          var mainPartyID = voteshareSortedCandidateData[candidateDataNum].partyID
          currentDatePartyNameArray[mainPartyID] = politicalParties[mainPartyID].getNames()[0]
        }

        var partyIDToCandidateNames = {}
        for (let partyCandidateName in candidateData)
        {
          partyIDToCandidateNames[candidateData[partyCandidateName].partyID] = partyCandidateName
        }

        var mostRecentParty = heldRegionMap ? heldRegionMap[regionNameToID[regionToFind]] :  mostRecentWinner(filteredMapData, currentMapDate.getTime(), regionNameToID[regionToFind])
        filteredDateData[regionNameToID[regionToFind]] = {region: regionNameToID[regionToFind], offYear: isOffyear, runoff: isRunoffElection, isSpecial: isSpecialElection, disabled: mapDataRows[0][columnMap.isDisabled] == "TRUE", margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: shouldIncludeVoteshare ? voteshareSortedCandidateData : null, flip: mostRecentParty != greatestMarginPartyID && mostRecentParty != TossupParty.getID()}
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
      partyNameData[mapDates[dateNum]] = currentDatePartyNameArray
    }

    var fullFilteredMapData = cloneObject(filteredMapData)
    for (var mapDate in fullFilteredMapData)
    {
      let filteredDateData = fullFilteredMapData[mapDate]

      if (Object.values(filteredDateData).length == 0) { continue }

      let isOffyear = Object.values(filteredDateData)[0].offYear
      var isRunoff = Object.values(filteredDateData)[0].isRunoff

      var regionIDsInFilteredDateData = Object.keys(filteredDateData)
      for (let regionNum in regionIDs)
      {
        if (regionIDs[regionNum] == nationalPopularVoteID) { continue }

        if (!regionIDsInFilteredDateData.includes(regionIDs[regionNum]))
        {
          filteredDateData[regionIDs[regionNum]] = {region: regionIDs[regionNum], margin: 101, partyID: mostRecentWinner(filteredMapData, mapDate, regionIDs[regionNum]), disabled: true, offYear: isOffyear, runoff: isRunoff}
        }
      }

      fullFilteredMapData[mapDate] = filteredDateData
    }

    if (!currentMapType.getMapSettingValue("offYear"))
    {
      var filteredMapDates = []
      for (mapDate in fullFilteredMapData)
      {
        if (Object.values(fullFilteredMapData[mapDate]).length == 0) { continue }

        var offYear = Object.values(fullFilteredMapData[mapDate])[0].offYear
        var runoff = Object.values(fullFilteredMapData[mapDate])[0].runoff

        if (!offYear && !runoff)
        {
          filteredMapDates.push(parseInt(mapDate))
        }
        if (runoff)
        {
          for (var regionID in fullFilteredMapData[mapDate])
          {
            if (regionIDs[regionNum] == nationalPopularVoteID) { continue }

            if (fullFilteredMapData[mapDate][regionID].runoff)
            {
              fullFilteredMapData[filteredMapDates[filteredMapDates.length-1]][regionID] = fullFilteredMapData[mapDate][regionID]
            }
          }
        }
      }

      mapDates = filteredMapDates
    }

    return {mapData: fullFilteredMapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  function mostRecentWinner(mapData, dateToStart, regionID)
  {
    var reversedMapDates = cloneObject(Object.keys(mapData)).reverse()

    var startYear = (new Date(parseInt(dateToStart))).getFullYear()

    for (var dateNum in reversedMapDates)
    {
      if (reversedMapDates[dateNum] >= parseInt(dateToStart)) { continue }

      var currentYear = (new Date(parseInt(reversedMapDates[dateNum]))).getFullYear()

      if (startYear-currentYear > 4)
      {
        return TossupParty.getID()
      }

      var mapDataFromDate = mapData[reversedMapDates[dateNum]]
      if (regionID in mapDataFromDate)
      {
        return mapDataFromDate[regionID].partyID
      }
    }

    return TossupParty.getID()
  }

  function customMapConvertMapDataToCSVFunction(columnKey, mapDateString, regionID, regionNameToID, candidateName, partyID, regionData, shouldUseVoteshare)
  {
    switch (columnKey)
    {
      case "date":
      return mapDateString

      case "candidateName":
      return candidateName

      case "voteshare":
      var voteshareData = shouldUseVoteshare && regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.voteshare/100.0
      }
      else if (regionData.partyID == partyID)
      {
        return regionData.margin/100.0
      }
      return 0

      case "region":
      return getKeyByValue(regionNameToID, regionID)

      case "partyID":
      return partyID

      case "order":
      var voteshareData = regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.order
      }
      return ""

      case "isSpecial":
      return (regionData.isSpecial == null ? false : regionData.isSpecial).toString().toUpperCase()

      case "isRunoff":
      return (regionData.runoff == null ? false : regionData.runoff).toString().toUpperCase()

      case "isOffyear":
      return (regionData.offYear == null ? false : regionData.offYear).toString().toUpperCase()

      case "isDisabled":
      return (regionData.disabled == null ? false : regionData.disabled).toString().toUpperCase()
    }
  }

  var FiveThirtyEightGovernorProjectionMapSource = new MapSource(
    "538-2022-Governor-Projection", // id
    "538 Projection", // name
    "https://projects.fivethirtyeight.com/2022-general-election-forecast-data/governor_state_toplines_2022.csv", // dataURL
    "https://projects.fivethirtyeight.com/2022-election-forecast/governor/", // homepageURL
    {regular: "./assets/fivethirtyeight-large.png", mini: "./assets/fivethirtyeight.png"}, // iconURL
    {
      date: "forecastdate",
      region: "district",
      pollType: "expression"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    {"AL":"alabama", "AK":"alaska", "AZ":"arizona", "AR":"arkansas", "CA":"california", "CO":"colorado", "CT":"connecticut", "DE":"delaware", "FL":"florida", "GA":"georgia", "HI":"hawaii", "ID":"idaho", "IL":"illinois", "IN":"indiana", "IA":"iowa", "KS":"kansas", "KY":"kentucky", "LA":"louisiana", "ME":"maine", "MD":"maryland", "MA":"massachusetts", "MI":"michigan", "MN":"minnesota", "MS":"mississippi", "MO":"missouri", "MT":"montana", "NE":"nebraska", "NV":"nevada", "NH":"new-hampshire", "NJ":"new-jersey", "NM":"new-mexico", "NY":"new-york", "NC":"north-carolina", "ND":"north-dakota", "OH":"ohio", "OK":"oklahoma", "OR":"oregon", "PA":"pennsylvania", "RI":"rhode-island", "SC":"south-carolina", "SD":"south-dakota", "TN":"tennessee", "TX":"texas", "UT":"utah", "VT":"vermont", "VA":"virginia", "WA":"washington", "WV":"west-virginia", "WI":"wisconsin", "WY":"wyoming"}, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    singleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, _, shouldOpenHomepage)
    {
      if (!shouldOpenHomepage && !regionID) return

      let linkToOpen = homepageURL
      if (!shouldOpenHomepage)
      {
        linkToOpen += regionIDToLinkMap[regionID]
      }

      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0 // voteshareCutoffMargin
  )

  const LTE2022GovernorYouTubeIDs = {
    1628380800000: "XXjRhuaFWuc",
    1630886400000: "QCN0K03rmRI",
    1636416000000: "rG30Fokvs5E",
    1641081600000: "Cei7ecOeqrU",
    1643760000000: "b4QU6eTz-dM",
    1646611200000: "NtnH-tK_IVU",
    1650153600000: "qpdq8r_pKuI",
    1654041600000: "Ps24mzQlaXM",
    1658188800000: "RrRscvpmwEY",
    1660176000000: "d9bZ6IQBrHI"
  }

  var LTEGovernorProjectionMapSource = new MapSource(
    "LTE-2022-Governor-Projection", // id
    "LTE Projection", // name
    "./csv-sources/lte-2022-governor.csv", // dataURL
    "https://www.youtube.com/watch?v=", // homepageURL
    {regular: "./assets/lte-large.png", mini: "./assets/lte.png"}, // iconURL
    {
      date: "date",
      region: "region",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    null, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, _, __, mapDate, ___, ____)
    {
      if (mapDate == null) { return }

      var linkToOpen = homepageURL
      linkToOpen += LTE2022GovernorYouTubeIDs[mapDate.getUTCAdjustedTime()]
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    false // shouldShowVoteshare
  )

  const Cook2022GovernorRatingIDs = {
    1612137600000: "231801",
    1618272000000: "231816",
    1619740800000: "231826",
    1624579200000: "231836",
    1625788800000: "231846",
    1628208000000: "231881",
    1630368000000: "231906",
    1631491200000: "231916",
    1631664000000: "231936",
    1632441600000: "231946",
    1633392000000: "232571",
    1638489600000: "238396",
    1644883200000: "248216",
    1646352000000: "252481",
    1652832000000: "288881",
    1654646400000: "297341",
    1658275200000: "303771",
    1658448000000: ""
  }

  var CookGovernorProjectionMapSource = new MapSource(
    "Cook-2022-Governor", // id
    "Cook Political", // name
    "./csv-sources/cook-governor-2022.csv", // dataURL
    "https://cookpolitical.com/ratings/governor-race-ratings/", // homepageURL
    {regular: "./assets/cookpolitical-large.png", mini: "./assets/cookpolitical.png"}, // iconURL
    {
      date: "date",
      region: "region",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    null, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    false, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, _, __, mapDate, ___)
    {
      if (mapDate == null) { return }
      window.open(homepageURL + (Cook2022GovernorRatingIDs[mapDate.getUTCAdjustedTime()] || ""))
    }, // customOpenRegionLinkFunction
    null // updateCustomMapFunction
  )

  var PastElectionResultMapSource = new MapSource(
    "Past-Governor-Elections", // id
    "Past Elections", // name
    "./csv-sources/past-governor.csv", // dataURL
    "https://en.wikipedia.org/wiki/", // homepageURL
    "./assets/wikipedia-large.png", // iconURL
    {
      date: "date",
      region: "region",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    null, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToID
    {"AL":"Alabama", "AK":"Alaska", "AZ":"Arizona", "AR":"Arkansas", "CA":"California", "CO":"Colorado", "CT":"Connecticut", "DE":"Delaware", "FL":"Florida", "GA":"Georgia", "HI":"Hawaii", "ID":"Idaho", "IL":"Illinois", "IN":"Indiana", "IA":"Iowa", "KS":"Kansas", "KY":"Kentucky", "LA":"Louisiana", "ME":"Maine", "MD":"Maryland", "MA":"Massachusetts", "MI":"Michigan", "MN":"Minnesota", "MS":"Mississippi", "MO":"Missouri", "MT":"Montana", "NE":"Nebraska", "NV":"Nevada", "NH":"New_Hampshire", "NJ":"New_Jersey", "NM":"New_Mexico", "NY":"New_York", "NC":"North_Carolina", "ND":"North_Dakota", "OH":"Ohio", "OK":"Oklahoma", "OR":"Oregon", "PA":"Pennsylvania", "RI":"Rhode_Island", "SC":"South_Carolina", "SD":"South_Dakota", "TN":"Tennessee", "TX":"Texas", "UT":"Utah", "VT":"Vermont", "VA":"Virginia", "WA":"Washington", "WV":"West_Virginia", "WI":"Wisconsin", "WY":"Wyoming"}, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage, _)
    {
      if (mapDate == null) { return }

      // var isSpecial = false
      // if (regionID != null && mapDate != null)
      // {
      //   isSpecial = mapData[mapDate.getTime()][regionID].isSpecial
      // }

      var linkToOpen = homepageURL + mapDate.getFullYear()
      if (!shouldOpenHomepage)
      {
        linkToOpen += "_" + regionIDToLinkMap[regionID] + "_gubernatorial_election"
      }
      else
      {
        linkToOpen += "_United_States_gubernatorial_elections"
      }
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0 // voteshareCutoffMargin
  )

  var idsToPartyNames = {}
  var partyNamesToIDs = {}
  for (var partyNum in mainPoliticalPartyIDs)
  {
    if (mainPoliticalPartyIDs[partyNum] == TossupParty.getID()) { continue }

    partyNamesToIDs[politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]] = mainPoliticalPartyIDs[partyNum]
    idsToPartyNames[mainPoliticalPartyIDs[partyNum]] = politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]
  }

  var CustomMapSource = new MapSource(
    "Custom-Governor", // id
    "Custom", // name
    null, // dataURL
    null, // homepageURL
    null, // iconURL
    {
      date: "date",
      region: "region",
      isSpecial: "special",
      isRunoff: "runoff",
      isOffyear: "offyear",
      isDisabled: "disabled",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare",
      order: "order"
    }, // columnMap
    null, // cycleYear
    partyNamesToIDs, // candidateNameToPartyIDMap
    idsToPartyNames, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    null, // viewingDataFunction
    null, // zoomingDataFunction
    null, // splitVoteDataFunction
    null, // splitVoteDisplayOptions
    null, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    customMapConvertMapDataToCSVFunction, // convertMapDataRowToCSVFunction
    true, // isCustomMap
    false, // shouldClearDisabled
    null // shouldShowVoteshare
  )

  var todayDate = new Date()
  CustomMapSource.setTextMapData("date\n" + (todayDate.getMonth()+1) + "/" + todayDate.getDate() + "/" + todayDate.getFullYear())

  var governorMapSources = {}
  governorMapSources[FiveThirtyEightGovernorProjectionMapSource.getID()] = FiveThirtyEightGovernorProjectionMapSource
  governorMapSources[LTEGovernorProjectionMapSource.getID()] = LTEGovernorProjectionMapSource
  governorMapSources[CookGovernorProjectionMapSource.getID()] = CookGovernorProjectionMapSource
  governorMapSources[PastElectionResultMapSource.getID()] = PastElectionResultMapSource
  governorMapSources[CustomMapSource.getID()] = CustomMapSource

  var governorMapSourceIDs = [FiveThirtyEightGovernorProjectionMapSource.getID(), LTEGovernorProjectionMapSource.getID(), CookGovernorProjectionMapSource.getID(), PastElectionResultMapSource.getID()]
  if (USAGovernorMapType.getCustomMapEnabled())
  {
    governorMapSourceIDs.push(CustomMapSource.getID())
  }

  const kPastElectionsVsPastElections = 1

  var defaultGovernorCompareSourceIDs = {}
  defaultGovernorCompareSourceIDs[kPastElectionsVsPastElections] = [PastElectionResultMapSource.getID(), PastElectionResultMapSource.getID()]

  USAGovernorMapType.setMapSources(governorMapSources)
  USAGovernorMapType.setMapSourceIDs(governorMapSourceIDs)
  USAGovernorMapType.setDefaultCompareSourceIDs(defaultGovernorCompareSourceIDs)
  USAGovernorMapType.setCustomSourceID(CustomMapSource.getID())
}

function createHouseMapSources()
{
  const regionNameToIDHistorical = {"AL":"AL", "AK":"AK", "AZ":"AZ", "AR":"AR", "CA":"CA", "CO":"CO", "CT":"CT", "DE":"DE", "FL":"FL", "GA":"GA", "HI":"HI", "ID":"ID", "IL":"IL", "IN":"IN", "IA":"IA", "KS":"KS", "KY":"KY", "LA":"LA", "ME":"ME", "MD":"MD", "MA":"MA", "MI":"MI", "MN":"MN", "MS":"MS", "MO":"MO", "MT":"MT", "NE":"NE", "NV":"NV", "NH":"NH", "NJ":"NJ", "NM":"NM", "NY":"NY", "NC":"NC", "ND":"ND", "OH":"OH", "OK":"OK", "OR":"OR", "PA":"PA", "RI":"RI", "SC":"SC", "SD":"SD", "TN":"TN", "TX":"TX", "UT":"UT", "VT":"VT", "VA":"VA", "WA":"WA", "WV":"WV", "WI":"WI", "WY":"WY", "NPV":"NPV"}

  const heldSeatPartyIDs2022 = {"AL__1": republicanPartyID, "AL__2": republicanPartyID, "AL__3": republicanPartyID, "AL__4": republicanPartyID, "AL__5": republicanPartyID, "AL__6": republicanPartyID, "AL__7": democraticPartyID, "AK__0": republicanPartyID, "AZ__1": democraticPartyID, "AZ__2": democraticPartyID, "AZ__3": democraticPartyID, "AZ__4": republicanPartyID, "AZ__5": republicanPartyID, "AZ__6": republicanPartyID, "AZ__7": democraticPartyID, "AZ__8": republicanPartyID, "AZ__9": democraticPartyID, "AR__1": republicanPartyID, "AR__2": republicanPartyID, "AR__3": republicanPartyID, "AR__4": republicanPartyID, "CA__1": republicanPartyID, "CA__2": democraticPartyID, "CA__3": democraticPartyID, "CA__4": republicanPartyID, "CA__5": democraticPartyID, "CA__6": democraticPartyID, "CA__7": democraticPartyID, "CA__8": republicanPartyID, "CA__9": democraticPartyID, "CA__10": democraticPartyID, "CA__11": democraticPartyID, "CA__12": democraticPartyID, "CA__13": democraticPartyID, "CA__14": democraticPartyID, "CA__15": democraticPartyID, "CA__16": democraticPartyID, "CA__17": democraticPartyID, "CA__18": democraticPartyID, "CA__19": democraticPartyID, "CA__20": democraticPartyID, "CA__21": republicanPartyID, "CA__22": republicanPartyID, "CA__23": republicanPartyID, "CA__24": democraticPartyID, "CA__25": republicanPartyID, "CA__26": democraticPartyID, "CA__27": democraticPartyID, "CA__28": democraticPartyID, "CA__29": democraticPartyID, "CA__30": democraticPartyID, "CA__31": democraticPartyID, "CA__32": democraticPartyID, "CA__33": democraticPartyID, "CA__34": democraticPartyID, "CA__35": democraticPartyID, "CA__36": democraticPartyID, "CA__37": democraticPartyID, "CA__38": democraticPartyID, "CA__39": republicanPartyID, "CA__40": democraticPartyID, "CA__41": democraticPartyID, "CA__42": republicanPartyID, "CA__43": democraticPartyID, "CA__44": democraticPartyID, "CA__45": democraticPartyID, "CA__46": democraticPartyID, "CA__47": democraticPartyID, "CA__48": republicanPartyID, "CA__49": democraticPartyID, "CA__50": republicanPartyID, "CA__51": democraticPartyID, "CA__52": democraticPartyID, "CA__53": democraticPartyID, "CO__1": democraticPartyID, "CO__2": democraticPartyID, "CO__3": republicanPartyID, "CO__4": republicanPartyID, "CO__5": republicanPartyID, "CO__6": democraticPartyID, "CO__7": democraticPartyID, "CT__1": democraticPartyID, "CT__2": democraticPartyID, "CT__3": democraticPartyID, "CT__4": democraticPartyID, "CT__5": democraticPartyID, "DE__0": democraticPartyID, "FL__1": republicanPartyID, "FL__2": republicanPartyID, "FL__3": republicanPartyID, "FL__4": republicanPartyID, "FL__5": democraticPartyID, "FL__6": republicanPartyID, "FL__7": democraticPartyID, "FL__8": republicanPartyID, "FL__9": democraticPartyID, "FL__10": democraticPartyID, "FL__11": republicanPartyID, "FL__12": republicanPartyID, "FL__13": democraticPartyID, "FL__14": democraticPartyID, "FL__15": republicanPartyID, "FL__16": republicanPartyID, "FL__17": republicanPartyID, "FL__18": republicanPartyID, "FL__19": republicanPartyID, "FL__20": democraticPartyID, "FL__21": democraticPartyID, "FL__22": democraticPartyID, "FL__23": democraticPartyID, "FL__24": democraticPartyID, "FL__25": republicanPartyID, "FL__26": republicanPartyID, "FL__27": republicanPartyID, "GA__1": republicanPartyID, "GA__8": republicanPartyID, "GA__3": republicanPartyID, "GA__4": democraticPartyID, "GA__5": democraticPartyID, "GA__6": democraticPartyID, "GA__7": democraticPartyID, "GA__2": democraticPartyID, "GA__9": republicanPartyID, "GA__10": republicanPartyID, "GA__11": republicanPartyID, "GA__12": republicanPartyID, "GA__13": democraticPartyID, "GA__14": republicanPartyID, "HI__1": democraticPartyID, "HI__2": democraticPartyID, "ID__1": republicanPartyID, "ID__2": republicanPartyID, "IL__1": democraticPartyID, "IL__2": democraticPartyID, "IL__3": democraticPartyID, "IL__4": democraticPartyID, "IL__5": democraticPartyID, "IL__6": democraticPartyID, "IL__7": democraticPartyID, "IL__8": democraticPartyID, "IL__9": democraticPartyID, "IL__10": democraticPartyID, "IL__11": democraticPartyID, "IL__12": republicanPartyID, "IL__13": republicanPartyID, "IL__14": democraticPartyID, "IL__15": republicanPartyID, "IL__16": republicanPartyID, "IL__17": democraticPartyID, "IL__18": republicanPartyID, "IN__1": democraticPartyID, "IN__2": republicanPartyID, "IN__3": republicanPartyID, "IN__4": republicanPartyID, "IN__5": republicanPartyID, "IN__6": republicanPartyID, "IN__7": democraticPartyID, "IN__8": republicanPartyID, "IN__9": republicanPartyID, "IA__1": republicanPartyID, "IA__2": republicanPartyID, "IA__3": democraticPartyID, "IA__4": republicanPartyID, "KS__1": republicanPartyID, "KS__2": republicanPartyID, "KS__3": democraticPartyID, "KS__4": republicanPartyID, "KY__1": republicanPartyID, "KY__2": republicanPartyID, "KY__3": democraticPartyID, "KY__4": republicanPartyID, "KY__5": republicanPartyID, "KY__6": republicanPartyID, "LA__1": republicanPartyID, "LA__2": democraticPartyID, "LA__3": republicanPartyID, "LA__4": republicanPartyID, "LA__5": republicanPartyID, "LA__6": republicanPartyID, "ME__1": democraticPartyID, "ME__2": democraticPartyID, "MD__1": republicanPartyID, "MD__2": democraticPartyID, "MD__3": democraticPartyID, "MD__4": democraticPartyID, "MD__5": democraticPartyID, "MD__6": democraticPartyID, "MD__7": democraticPartyID, "MD__8": democraticPartyID, "MA__1": democraticPartyID, "MA__2": democraticPartyID, "MA__3": democraticPartyID, "MA__4": democraticPartyID, "MA__5": democraticPartyID, "MA__6": democraticPartyID, "MA__7": democraticPartyID, "MA__8": democraticPartyID, "MA__9": democraticPartyID, "MI__1": republicanPartyID, "MI__2": republicanPartyID, "MI__3": republicanPartyID, "MI__4": republicanPartyID, "MI__5": democraticPartyID, "MI__6": republicanPartyID, "MI__7": republicanPartyID, "MI__8": democraticPartyID, "MI__9": democraticPartyID, "MI__10": republicanPartyID, "MI__11": democraticPartyID, "MI__12": democraticPartyID, "MI__13": democraticPartyID, "MI__14": democraticPartyID, "MN__1": republicanPartyID, "MN__2": democraticPartyID, "MN__3": democraticPartyID, "MN__4": democraticPartyID, "MN__5": democraticPartyID, "MN__6": republicanPartyID, "MN__7": republicanPartyID, "MN__8": republicanPartyID, "MS__1": republicanPartyID, "MS__2": democraticPartyID, "MS__3": republicanPartyID, "MS__4": republicanPartyID, "MO__1": democraticPartyID, "MO__2": republicanPartyID, "MO__3": republicanPartyID, "MO__4": republicanPartyID, "MO__5": democraticPartyID, "MO__6": republicanPartyID, "MO__7": republicanPartyID, "MO__8": republicanPartyID, "MT__0": republicanPartyID, "NE__1": republicanPartyID, "NE__2": republicanPartyID, "NE__3": republicanPartyID, "NV__1": democraticPartyID, "NV__2": republicanPartyID, "NV__3": democraticPartyID, "NV__4": democraticPartyID, "NH__1": democraticPartyID, "NH__2": democraticPartyID, "NJ__1": democraticPartyID, "NJ__2": republicanPartyID, "NJ__3": democraticPartyID, "NJ__4": republicanPartyID, "NJ__5": democraticPartyID, "NJ__6": democraticPartyID, "NJ__7": democraticPartyID, "NJ__8": democraticPartyID, "NJ__9": democraticPartyID, "NJ__10": democraticPartyID, "NJ__11": democraticPartyID, "NJ__12": democraticPartyID, "NM__1": democraticPartyID, "NM__2": republicanPartyID, "NM__3": democraticPartyID, "NY__1": republicanPartyID, "NY__2": republicanPartyID, "NY__3": democraticPartyID, "NY__4": democraticPartyID, "NY__5": democraticPartyID, "NY__6": democraticPartyID, "NY__7": democraticPartyID, "NY__8": democraticPartyID, "NY__9": democraticPartyID, "NY__10": democraticPartyID, "NY__11": republicanPartyID, "NY__12": democraticPartyID, "NY__13": democraticPartyID, "NY__14": democraticPartyID, "NY__15": democraticPartyID, "NY__16": democraticPartyID, "NY__17": democraticPartyID, "NY__18": democraticPartyID, "NY__19": democraticPartyID, "NY__20": democraticPartyID, "NY__21": republicanPartyID, "NY__22": republicanPartyID, "NY__23": republicanPartyID, "NY__24": republicanPartyID, "NY__25": democraticPartyID, "NY__26": democraticPartyID, "NY__27": republicanPartyID, "NC__1": democraticPartyID, "NC__2": democraticPartyID, "NC__3": republicanPartyID, "NC__4": democraticPartyID, "NC__5": republicanPartyID, "NC__6": democraticPartyID, "NC__7": republicanPartyID, "NC__8": republicanPartyID, "NC__9": republicanPartyID, "NC__10": republicanPartyID, "NC__11": republicanPartyID, "NC__12": democraticPartyID, "NC__13": republicanPartyID, "ND__0": republicanPartyID, "OH__1": republicanPartyID, "OH__2": republicanPartyID, "OH__3": democraticPartyID, "OH__4": republicanPartyID, "OH__5": republicanPartyID, "OH__6": republicanPartyID, "OH__7": republicanPartyID, "OH__8": republicanPartyID, "OH__9": democraticPartyID, "OH__10": republicanPartyID, "OH__11": democraticPartyID, "OH__12": republicanPartyID, "OH__13": democraticPartyID, "OH__14": republicanPartyID, "OH__15": republicanPartyID, "OH__16": republicanPartyID, "OK__1": republicanPartyID, "OK__2": republicanPartyID, "OK__3": republicanPartyID, "OK__4": republicanPartyID, "OK__5": republicanPartyID, "OR__1": democraticPartyID, "OR__2": republicanPartyID, "OR__3": democraticPartyID, "OR__4": democraticPartyID, "OR__5": democraticPartyID, "PA__1": republicanPartyID, "PA__2": democraticPartyID, "PA__3": democraticPartyID, "PA__4": democraticPartyID, "PA__5": democraticPartyID, "PA__6": democraticPartyID, "PA__7": democraticPartyID, "PA__8": democraticPartyID, "PA__9": republicanPartyID, "PA__10": republicanPartyID, "PA__11": republicanPartyID, "PA__12": republicanPartyID, "PA__13": republicanPartyID, "PA__14": republicanPartyID, "PA__15": republicanPartyID, "PA__16": republicanPartyID, "PA__17": democraticPartyID, "PA__18": democraticPartyID, "RI__1": democraticPartyID, "RI__2": democraticPartyID, "SC__1": republicanPartyID, "SC__2": republicanPartyID, "SC__3": republicanPartyID, "SC__4": republicanPartyID, "SC__5": republicanPartyID, "SC__6": democraticPartyID, "SC__7": republicanPartyID, "SD__0": republicanPartyID, "TN__1": republicanPartyID, "TN__2": republicanPartyID, "TN__3": republicanPartyID, "TN__4": republicanPartyID, "TN__5": democraticPartyID, "TN__6": republicanPartyID, "TN__7": republicanPartyID, "TN__8": republicanPartyID, "TN__9": democraticPartyID, "TX__1": republicanPartyID, "TX__2": republicanPartyID, "TX__3": republicanPartyID, "TX__4": republicanPartyID, "TX__5": republicanPartyID, "TX__6": republicanPartyID, "TX__7": democraticPartyID, "TX__8": republicanPartyID, "TX__18": democraticPartyID, "TX__10": republicanPartyID, "TX__11": republicanPartyID, "TX__12": republicanPartyID, "TX__13": republicanPartyID, "TX__14": republicanPartyID, "TX__15": democraticPartyID, "TX__16": democraticPartyID, "TX__17": republicanPartyID, "TX__9": democraticPartyID, "TX__19": republicanPartyID, "TX__20": democraticPartyID, "TX__21": republicanPartyID, "TX__22": republicanPartyID, "TX__23": republicanPartyID, "TX__24": republicanPartyID, "TX__25": republicanPartyID, "TX__26": republicanPartyID, "TX__27": republicanPartyID, "TX__28": democraticPartyID, "TX__29": democraticPartyID, "TX__30": democraticPartyID, "TX__31": republicanPartyID, "TX__32": democraticPartyID, "TX__33": democraticPartyID, "TX__34": democraticPartyID, "TX__35": democraticPartyID, "TX__36": republicanPartyID, "UT__1": republicanPartyID, "UT__2": republicanPartyID, "UT__3": republicanPartyID, "UT__4": republicanPartyID, "VT__0": democraticPartyID, "VA__1": republicanPartyID, "VA__2": democraticPartyID, "VA__3": democraticPartyID, "VA__4": democraticPartyID, "VA__5": republicanPartyID, "VA__6": republicanPartyID, "VA__7": democraticPartyID, "VA__8": democraticPartyID, "VA__9": republicanPartyID, "VA__10": democraticPartyID, "VA__11": democraticPartyID, "WA__1": democraticPartyID, "WA__2": democraticPartyID, "WA__3": republicanPartyID, "WA__4": republicanPartyID, "WA__5": republicanPartyID, "WA__6": democraticPartyID, "WA__7": democraticPartyID, "WA__8": democraticPartyID, "WA__9": democraticPartyID, "WA__10": democraticPartyID, "WV__1": republicanPartyID, "WV__2": republicanPartyID, "WV__3": republicanPartyID, "WI__1": republicanPartyID, "WI__2": democraticPartyID, "WI__3": democraticPartyID, "WI__4": democraticPartyID, "WI__5": republicanPartyID, "WI__6": republicanPartyID, "WI__7": republicanPartyID, "WI__8": republicanPartyID, "WY__0": republicanPartyID}

  var singleLineVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, _, __, ___, heldRegionMap, ____, _____, voteshareCutoffMargin)
  {
    let mapData = {}
    let partyNameData = {}

    const deluxeProjectionType = "_deluxe"
    const candidateColumns = {[DemocraticParty.getID()]: ["D1", "D2", "D3", "D4"], [RepublicanParty.getID()]: ["R1", "R2", "R3", "R4"], [IndependentGenericParty.getID()]: ["I1", "O1"]}
    const candidateNameColumnPrefix = "name_"
    const candidateVoteshareColumnPrefix = "voteshare_mean_"
    const candidateWinColumnPrefix = "winner_"
    const netPartyMarginColumn = "mean_netpartymargin"

    const districtsToUsePartyForMargin = ["AK__1", "LA__5", "LA__3"]

    let partyNames = Object.keys(candidateColumns).map(partyID => politicalParties[partyID].getNames()[0])

    for (let mapDate of mapDates)
    {
      let rawDateData = rawMapData[mapDate].filter(mapRow => mapRow[columnMap.pollType] == deluxeProjectionType)
      let dateData = {}

      let stateDistrictCounts = {}

      for (let mapRow of rawDateData)
      {
        let [_, state, district] = /(\w\w)-(\d\d?)/.exec(mapRow[columnMap.region])
        let regionID = state + subregionSeparator + district

        if (!stateDistrictCounts[state])
        {
          stateDistrictCounts[state] = 1
        }
        else
        {
          stateDistrictCounts[state] += 1
        }

        let candidateArray = []

        for (let partyID in candidateColumns)
        {
          for (let candidateID of candidateColumns[partyID])
          {
            let candidateName = mapRow[candidateNameColumnPrefix + candidateID]
            if (candidateName == "") break

            let candidateLastName = capitalize(candidateName.replaceAll(",", "").replaceAll(/ III?$/g, "").replaceAll(/ Jr\.?/g, "").replaceAll(/ Sr\.?/g, "").split(" ").reverse()[0])

            candidateArray.push({candidate: candidateLastName, partyID: partyID, voteshare: parseFloat(mapRow[candidateVoteshareColumnPrefix + candidateID]), winPercentage: parseFloat(mapRow[candidateWinColumnPrefix + candidateID])*100})
          }
        }

        let voteshareSortedCandidateData = candidateArray.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
        voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)

        if (voteshareSortedCandidateData.length == 0)
        {
          console.log("No candidate data!", new Date(mapDate).getFullYear().toString(), regionID)
          continue
        }

        let greatestMarginPartyID
        let greatestMarginCandidateName
        let topTwoMargin

        if (districtsToUsePartyForMargin.includes(regionID))
        {
          topTwoMargin = parseFloat(mapRow[netPartyMarginColumn])
          greatestMarginPartyID = Math.sign(topTwoMargin) == 1 ? democraticPartyID : republicanPartyID
          greatestMarginCandidateName = politicalParties[greatestMarginPartyID].getNames()[0]
          topTwoMargin = Math.abs(topTwoMargin)

          console.log(regionID, topTwoMargin, mapRow[netPartyMarginColumn])
        }
        else if (voteshareSortedCandidateData[0].voteshare != 0)
        {
          greatestMarginPartyID = voteshareSortedCandidateData[0].partyID
          greatestMarginCandidateName = voteshareSortedCandidateData[0].candidate
          topTwoMargin = voteshareSortedCandidateData[0].voteshare - (voteshareSortedCandidateData[1] ? voteshareSortedCandidateData[1].voteshare : 0)
        }
        else
        {
          greatestMarginPartyID = TossupParty.getID()
          greatestMarginCandidateName = null
          topTwoMargin = 0
        }

        let partyIDToCandidateNames = {}
        for (let candidateData of voteshareSortedCandidateData)
        {
          partyIDToCandidateNames[candidateData.partyID] = candidateData.candidate
        }

        dateData[regionID] = {region: regionID, state: state, district: district, margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: voteshareSortedCandidateData, flip: heldRegionMap[regionID] != greatestMarginPartyID}
      }

      for (let state of Object.keys(stateDistrictCounts).filter(state => stateDistrictCounts[state] == 1))
      {
        let regionData = cloneObject(dateData[state + subregionSeparator + "1"])
        delete dateData[state + subregionSeparator + "1"]
        regionData.district = "0"
        regionData.region = state + subregionSeparator + "0"
        dateData[state + subregionSeparator + "0"] = regionData
      }

      mapData[mapDate] = dateData
      partyNameData[mapDate] = partyNames
    }

    return {mapData: mapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  var doubleLineVoteshareFilterFunction = function(rawMapData, mapDates, columnMap, _, __, regionNameToID, ___, _____, isCustomMap, voteshareCutoffMargin, shouldIncludeVoteshare)
  {
    var filteredMapData = {}
    var partyNameData = {}

    var regionNames = Object.keys(regionNameToID)

    for (var dateNum in mapDates)
    {
      var rawDateData = rawMapData[mapDates[dateNum]]
      var filteredDateData = {}

      var currentMapDate = new Date(mapDates[dateNum])
      var currentDatePartyNameArray = {}

      for (var regionNum in regionNames)
      {
        var regionToFind = regionNames[regionNum]

        var fullStateRows = rawDateData.filter(row => {
          return row[columnMap.region] == regionToFind
        })

        if (fullStateRows.length == 0)
        {
          if (isCustomMap && regionNameToID[regionToFind] != nationalPopularVoteID)
          {
            let partyIDToCandidateNames = {}
            for (let partyID of mainPoliticalPartyIDs)
            {
              partyIDToCandidateNames[partyID] = politicalParties[partyID].getNames()[0]
            }

            let decadeToFillFrom = getDecadeFromDate(currentMapDate)
            if (decadeToFillFrom > 2010)
            {
              decadeToFillFrom = 2010 // default/fallback to 2010 since 2020 map has not been released yet
            }

            let regionHouseSeatCount = USAHouseMapType.getEV(decadeToFillFrom, regionNameToID[regionToFind])
            for (let districtNumber in [...Array(regionHouseSeatCount).keys()])
            {
              if (regionHouseSeatCount > 1)
              {
                districtNumber = parseInt(districtNumber)+1
              }
              filteredDateData[regionNameToID[regionToFind] + subregionSeparator + districtNumber] = {region: regionNameToID[regionToFind] + subregionSeparator + districtNumber, state: regionNameToID[regionToFind], margin: 0, partyID: TossupParty.getID(), candidateMap: partyIDToCandidateNames}
            }
          }
          continue
        }

        var stateDistricts = [...new Set(fullStateRows.map(row => {
          return row[columnMap.district]
        }))]

        if (stateDistricts.length == 0)
        {
          console.log(regionToFind, currentMapDate)
        }

        for (let stateDistrict of stateDistricts)
        {
          var districtRows = fullStateRows.filter(row => {
            return row[columnMap.district] == stateDistrict
          })

          var fullRegionName = regionToFind + (regionToFind != "NPV" ? subregionSeparator + stateDistrict : "")

          var candidateData = {}

          for (var rowNum in districtRows)
          {
            var row = districtRows[rowNum]

            var candidateName = row[columnMap.candidateName]
            var currentVoteshare = parseFloat(row[columnMap.voteshare])
            var currentOrder = row[columnMap.order] ? parseInt(row[columnMap.order]) : null

            var currentPartyName = row[columnMap.partyID]
            var foundParty = Object.values(politicalParties).find(party => {
              var partyNames = cloneObject(party.getNames())
              for (var nameNum in partyNames)
              {
                partyNames[nameNum] = partyNames[nameNum].toLowerCase()
              }
              return partyNames.includes(currentPartyName)
            })

            if (!foundParty && Object.keys(politicalParties).includes(currentPartyName))
            {
              foundParty = politicalParties[currentPartyName]
            }

            var currentPartyID
            if (foundParty)
            {
              currentPartyID = foundParty.getID()
            }
            else
            {
              currentPartyID = IndependentGenericParty.getID()
            }

            if (Object.keys(candidateData).includes(candidateName))
            {
              if (currentVoteshare > candidateData[candidateName].voteshare)
              {
                candidateData[candidateName].partyID = currentPartyID
              }

              candidateData[candidateName].voteshare += currentVoteshare
            }
            else
            {
              candidateData[candidateName] = {candidate: candidateName, partyID: currentPartyID, voteshare: currentVoteshare, order: currentOrder}
            }
          }

          var voteshareSortedCandidateData = Object.values(candidateData)
          voteshareSortedCandidateData = voteshareSortedCandidateData.filter((candData) => !isNaN(candData.voteshare))
          voteshareSortedCandidateData.sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
          if (!isCustomMap && voteshareCutoffMargin != null)
          {
            voteshareSortedCandidateData = voteshareSortedCandidateData.filter(candData => candData.voteshare >= voteshareCutoffMargin)
          }

          if (voteshareSortedCandidateData.length == 0)
          {
            console.log("No candidate data!", currentMapDate.getFullYear().toString(), fullRegionName)
            continue
          }

          var greatestMarginPartyID
          var greatestMarginCandidateName
          var topTwoMargin

          if (voteshareSortedCandidateData[0].voteshare != 0)
          {
            let topCandidateData = voteshareSortedCandidateData.filter(candidateData => candidateData.order == 0 || candidateData.order == 1).sort((cand1, cand2) => cand2.voteshare - cand1.voteshare)
            if (topCandidateData.length == 0)
            {
              topCandidateData = [voteshareSortedCandidateData[0]]
              if (voteshareSortedCandidateData[1])
              {
                topCandidateData.push(voteshareSortedCandidateData[1])
              }
            }

            greatestMarginPartyID = topCandidateData[0].partyID
            greatestMarginCandidateName = topCandidateData[0].candidate
            topTwoMargin = topCandidateData[0].voteshare - (topCandidateData[1] ? topCandidateData[1].voteshare : 0)
          }
          else
          {
            greatestMarginPartyID = TossupParty.getID()
            greatestMarginCandidateName = null
            topTwoMargin = 0
          }

          for (var candidateDataNum in voteshareSortedCandidateData)
          {
            var mainPartyID = voteshareSortedCandidateData[candidateDataNum].partyID
            currentDatePartyNameArray[mainPartyID] = politicalParties[mainPartyID].getNames()[0]
          }

          var partyIDToCandidateNames = {}
          for (let partyCandidateName in candidateData)
          {
            partyIDToCandidateNames[candidateData[partyCandidateName].partyID] = partyCandidateName
          }

          var mostRecentParty = mostRecentWinner(filteredMapData, currentMapDate.getTime(), fullRegionName)
          filteredDateData[fullRegionName] = {region: fullRegionName, state: regionToFind, district: stateDistrict, margin: topTwoMargin, partyID: greatestMarginPartyID, candidateName: greatestMarginCandidateName, candidateMap: partyIDToCandidateNames, partyVotesharePercentages: shouldIncludeVoteshare ? voteshareSortedCandidateData : null, flip: mostRecentParty != greatestMarginPartyID && mostRecentParty != TossupParty.getID()}
        }
      }

      filteredMapData[mapDates[dateNum]] = filteredDateData
      partyNameData[mapDates[dateNum]] = currentDatePartyNameArray
    }

    return {mapData: filteredMapData, candidateNameData: partyNameData, mapDates: mapDates}
  }

  function mostRecentWinner(mapData, dateToStart, regionID)
  {
    var reversedMapDates = cloneObject(Object.keys(mapData)).reverse()

    var startYear = (new Date(parseInt(dateToStart))).getFullYear()

    for (var dateNum in reversedMapDates)
    {
      if (reversedMapDates[dateNum] >= parseInt(dateToStart)) { continue }

      var currentYear = (new Date(parseInt(reversedMapDates[dateNum]))).getFullYear()

      if (startYear-currentYear > 2)
      {
        return TossupParty.getID()
      }

      var mapDataFromDate = mapData[reversedMapDates[dateNum]]
      if (regionID in mapDataFromDate)
      {
        return mapDataFromDate[regionID].partyID
      }
    }

    return TossupParty.getID()
  }

  function customMapConvertMapDataToCSVFunction(columnKey, mapDateString, regionID, _, candidateName, partyID, regionData, shouldUseVoteshare)
  {
    switch (columnKey)
    {
      case "date":
      return mapDateString

      case "candidateName":
      return candidateName

      case "voteshare":
      var voteshareData = shouldUseVoteshare && regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.voteshare
      }
      else if (regionData.partyID == partyID)
      {
        return regionData.margin
      }
      return 0

      case "region":
      return regionData.state || regionID.split(subregionSeparator)[0]

      case "district":
      return regionData.district || regionID.split(subregionSeparator)[1]

      case "partyID":
      return partyID

      case "order":
      var voteshareData = regionData.partyVotesharePercentages ? regionData.partyVotesharePercentages.find(partyVoteshare => candidateName == partyVoteshare.candidate) : null
      if (voteshareData)
      {
        return voteshareData.order
      }
      return ""
    }
  }

  var getHouseSVGFromDate = function(dateTime)
  {
    var zoomRegion = currentMapZoomRegion

    if (currentViewingState == ViewingState.viewing && !currentMapType.getMapSettingValue("showAllDistricts"))
    {
      return "svg-sources/usa-governor-map.svg"
    }

    if ((currentViewingState == ViewingState.viewing && currentMapType.getMapSettingValue("showAllDistricts")) || (currentViewingState == ViewingState.zooming && currentMapType.getMapSettingValue("showStateDistricts")))
    {
      var dateYear = (new Date(dateTime)).getFullYear()
      if (dateYear >= 2022)
      {
        return ["svg-sources/usa-house-2022-map.svg", zoomRegion]
      }
      else if (dateYear >= 2020)
      {
        return ["svg-sources/usa-house-2020-map.svg", zoomRegion]
      }
      else if (dateYear >= 2018)
      {
        return ["svg-sources/usa-house-2018-map.svg", zoomRegion]
      }
      else if (dateYear >= 2016)
      {
        return ["svg-sources/usa-house-2016-map.svg", zoomRegion]
      }
      else if (dateYear >= 2012)
      {
        return ["svg-sources/usa-house-2012-map.svg", zoomRegion]
      }
      else if (dateYear >= 2006)
      {
        return ["svg-sources/usa-house-2006-map.svg", zoomRegion]
      }
      else if (dateYear >= 2004)
      {
        return ["svg-sources/usa-house-2004-map.svg", zoomRegion]
      }
      else if (dateYear >= 2002)
      {
        return ["svg-sources/usa-house-2002-map.svg", zoomRegion]
      }
      else if (dateYear >= 1998)
      {
        return ["svg-sources/usa-house-1998-map.svg", zoomRegion]
      }
      else if (dateYear >= 1996)
      {
        return ["svg-sources/usa-house-1996-map.svg", zoomRegion]
      }
      else if (dateYear >= 1994)
      {
        return ["svg-sources/usa-house-1994-map.svg", zoomRegion]
      }
      else if (dateYear >= 1992)
      {
        return ["svg-sources/usa-house-1992-map.svg", zoomRegion]
      }
      else if (dateYear >= 1984)
      {
        return ["svg-sources/usa-house-1984-map.svg", zoomRegion]
      }
      else if (dateYear >= 1982)
      {
        return ["svg-sources/usa-house-1982-map.svg", zoomRegion]
      }
      else if (dateYear >= 1976)
      {
        return ["svg-sources/usa-house-1976-map.svg", zoomRegion]
      }
    }

    return ["svg-sources/usa-governor-map.svg", zoomRegion, true, (mapDateData) => {
      $("#outlines").children().each(function() {
        if ($(this).attr(isDistrictBoxRegionAttribute) !== undefined)
        {
          $(this).remove()
        }
        else
        {
          $(this).attr(noInteractSVGRegionAttribute, "")
          $(this).attr(noCountSVGRegionAttribute, "")
        }
      })

      const districtBoxesPerLine = 6

      var boundingBox = $("#svgdata")[0].getBBox()

      var districtCount = Object.keys(mapDateData).length - (Object.keys(mapDateData).some(regionID => regionID.endsWith(subregionSeparator + statePopularVoteDistrictID)) ? 1 : 0)

      var districtBoxSize = Math.max(boundingBox.width, boundingBox.height)*0.07
      var districtBoxPadding = districtBoxSize/5
      var districtBoxCornerRadius = districtBoxSize/10

      var startingX = boundingBox.x + boundingBox.width/2 - (districtBoxesPerLine*(districtBoxSize+districtBoxPadding)-districtBoxPadding/2)/2
      var startingY = boundingBox.y + boundingBox.height/2 - (Math.ceil(districtCount/districtBoxesPerLine)*(districtBoxSize+districtBoxPadding)-districtBoxPadding/2)/2

      var districtBoxLineCount = Math.floor(districtCount/districtBoxesPerLine)+1

      var itemsOnLastLine = districtCount%districtBoxesPerLine > 0 ? districtCount%districtBoxesPerLine : districtBoxesPerLine
      var lastLineXOffset = (districtBoxesPerLine-itemsOnLastLine)*(districtBoxSize+districtBoxPadding)/2

      var outlineGroupHTML = ""
      outlineGroupHTML += "<rect " + isDistrictBoxRegionAttribute + " " + noInteractSVGRegionAttribute + " " + noCountSVGRegionAttribute + " fill='gray' fill-opacity='0.7' width='" + ((districtBoxLineCount == 1 ? itemsOnLastLine : districtBoxesPerLine)*(districtBoxSize+districtBoxPadding)+districtBoxPadding) + "' height='" + (Math.ceil(districtCount/districtBoxesPerLine)*(districtBoxSize+districtBoxPadding)+districtBoxPadding) + "' x='" + (startingX-districtBoxPadding+(districtBoxLineCount == 1 ? lastLineXOffset : 0)) + "' y='" + (startingY-districtBoxPadding) + "' rx='" + districtBoxCornerRadius + "' ry='" + districtBoxCornerRadius  + "'></rect>"
      Object.keys(mapDateData).forEach((regionID, i) => {
        if (regionID.endsWith(subregionSeparator + statePopularVoteDistrictID)) { return }

        var districtBoxLineOn = Math.floor(i/districtBoxesPerLine)
        outlineGroupHTML += "<rect " + isDistrictBoxRegionAttribute + " id='" + regionID + "' width='" + districtBoxSize + "' height='" + districtBoxSize + "' x='" + (startingX + i%districtBoxesPerLine*(districtBoxSize+districtBoxPadding) + (districtBoxLineOn == districtBoxLineCount-1 ? lastLineXOffset : 0)) + "' y='" + (startingY + districtBoxLineOn*(districtBoxSize+districtBoxPadding)) + "' rx='" + districtBoxCornerRadius + "' ry='" + districtBoxCornerRadius  + "' ></rect>"
      })

      $("#outlines").append(outlineGroupHTML)
      var svgDataHTML = $("#svgdata").html()
      $("#svgdata").html(svgDataHTML)
    }]
  }

  var houseViewingData = async (mapDateData) => {
    var usedFallbackMap = USAHouseMapType.getSVGPath()[2] || false
    if (currentMapType.getMapSettingValue("showAllDistricts") && !usedFallbackMap)
    {
      return mapDateData
    }

    var housePerStateMapData = {}

    for (let regionID in mapDateData)
    {
      if (regionID.endsWith(subregionSeparator + statePopularVoteDistrictID)) { continue }

      var regionData = mapDateData[regionID]

      if (!(regionData.state in housePerStateMapData))
      {
        housePerStateMapData[regionData.state] = {region: regionData.state, voteSplits: []}
      }

      var partyVoteSplitData = housePerStateMapData[regionData.state].voteSplits
      var partyVote = partyVoteSplitData.find(partyVoteItem => partyVoteItem.partyID == regionData.partyID)
      if (!partyVote)
      {
        partyVote = {partyID: regionData.partyID, candidate: politicalParties[regionData.partyID].getNames()[0], votes: 0}
        partyVoteSplitData.push(partyVote)
      }
      partyVote.votes++

      if (regionData.flip)
      {
        housePerStateMapData[regionData.state].flip = true
      }
    }

    for (let regionID in housePerStateMapData)
    {
      var partyVoteSplitData = housePerStateMapData[regionID].voteSplits
      partyVoteSplitData.sort((partyVote1, partyVote2) => partyVote2.votes-partyVote1.votes)

      var largestPartyCount = partyVoteSplitData[0].votes
      var largestPartyID = partyVoteSplitData[0].partyID
      var secondLargestPartyCount = partyVoteSplitData[1] ? partyVoteSplitData[1].votes : 0

      housePerStateMapData[regionID].margin = (largestPartyCount/(largestPartyCount+secondLargestPartyCount)*100-50)*0.9001 // +0.001 to account for rounding errors
      housePerStateMapData[regionID].partyID = largestPartyID
    }

    if (mapDateData["NPV"])
    {
      housePerStateMapData["NPV"] = cloneObject(mapDateData["NPV"])
    }

    return housePerStateMapData
  }

  var houseZoomingData = async (mapDateData, zoomRegion) => {
    var stateMapData = {}

    Object.keys(mapDateData).filter(regionID => mapDateData[regionID].state == zoomRegion)
    .sort((regionID1, regionID2) => mapDateData[regionID1].district-mapDateData[regionID2].district)
    .forEach(regionID => {
      stateMapData[regionID] = cloneObject(mapDateData[regionID])
    })

    return stateMapData
  }

  var houseFormattedRegionName = (regionID) => {
    if (!regionID || !regionID.includes(subregionSeparator)) { return regionID }

    let state = regionID.split(subregionSeparator)[0]
    let districtNumber = regionID.split(subregionSeparator)[1]

    if (districtNumber == "0")
    {
      districtNumber = "AL"
    }

    return state + "-" + districtNumber
  }

  var FiveThirtyEightHouseProjectionMapSource = new MapSource(
    "538-2022-House-Projection", // id
    "538 Projection", // name
    "https://projects.fivethirtyeight.com/2022-general-election-forecast-data/house_district_toplines_2022.csv", // dataURL
    "https://projects.fivethirtyeight.com/2022-election-forecast/house/", // homepageURL
    {regular: "./assets/fivethirtyeight-large.png", mini: "./assets/fivethirtyeight.png"}, // iconURL
    {
      date: "forecastdate",
      region: "district",
      pollType: "expression"
    }, // columnMap
    2022, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    {"AL":"alabama", "AK":"alaska", "AZ":"arizona", "AR":"arkansas", "CA":"california", "CO":"colorado", "CT":"connecticut", "DE":"delaware", "FL":"florida", "GA":"georgia", "HI":"hawaii", "ID":"idaho", "IL":"illinois", "IN":"indiana", "IA":"iowa", "KS":"kansas", "KY":"kentucky", "LA":"louisiana", "ME":"maine", "MD":"maryland", "MA":"massachusetts", "MI":"michigan", "MN":"minnesota", "MS":"mississippi", "MO":"missouri", "MT":"montana", "NE":"nebraska", "NV":"nevada", "NH":"new-hampshire", "NJ":"new-jersey", "NM":"new-mexico", "NY":"new-york", "NC":"north-carolina", "ND":"north-dakota", "OH":"ohio", "OK":"oklahoma", "OR":"oregon", "PA":"pennsylvania", "RI":"rhode-island", "SC":"south-carolina", "SD":"south-dakota", "TN":"tennessee", "TX":"texas", "UT":"utah", "VT":"vermont", "VA":"virginia", "WA":"washington", "WV":"west-virginia", "WI":"wisconsin", "WY":"wyoming"}, // regionIDToLinkMap
    heldSeatPartyIDs2022, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    singleLineVoteshareFilterFunction, // organizeMapDataFunction
    houseViewingData, // viewingDataFunction
    houseZoomingData, // zoomingDataFunction
    null, // splitVoteDataFunction
    {showSplitVotesOnCanZoom: true, showSplitVoteBoxes: true}, // splitVoteDisplayOptions
    houseFormattedRegionName, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage, mapData)
    {
      if (!shouldOpenHomepage && (!regionID || !mapData || !mapData[mapDate.getTime()] || !mapData[mapDate.getTime()][regionID])) return

      let linkToOpen = homepageURL
      if (!shouldOpenHomepage)
      {
        linkToOpen += regionIDToLinkMap[mapData[mapDate.getTime()][regionID].state] + "/" + mapData[mapDate.getTime()][regionID].district
      }

      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0, // voteshareCutoffMargin
    getHouseSVGFromDate, // overrideSVGPath
    null, // shouldSetDisabledWorthToZero
    true // shouldUseOriginalMapDataForTotalsPieChart
  )

  var PastElectionResultMapSource = new MapSource(
    "Past-House-Elections", // id
    "Past Elections", // name
    "./csv-sources/past-house.csv", // dataURL
    "https://en.wikipedia.org/wiki/", // homepageURL
    "./assets/wikipedia-large.png", // iconURL
    {
      date: "date",
      region: "region",
      district: "district",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare"
    }, // columnMap
    null, // cycleYear
    null, // candidateNameToPartyIDMap
    null, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToID
    {"AL":"Alabama", "AK":"Alaska", "AZ":"Arizona", "AR":"Arkansas", "CA":"California", "CO":"Colorado", "CT":"Connecticut", "DE":"Delaware", "FL":"Florida", "GA":"Georgia", "HI":"Hawaii", "ID":"Idaho", "IL":"Illinois", "IN":"Indiana", "IA":"Iowa", "KS":"Kansas", "KY":"Kentucky", "LA":"Louisiana", "ME":"Maine", "MD":"Maryland", "MA":"Massachusetts", "MI":"Michigan", "MN":"Minnesota", "MS":"Mississippi", "MO":"Missouri", "MT":"Montana", "NE":"Nebraska", "NV":"Nevada", "NH":"New_Hampshire", "NJ":"New_Jersey", "NM":"New_Mexico", "NY":"New_York", "NC":"North_Carolina", "ND":"North_Dakota", "OH":"Ohio", "OK":"Oklahoma", "OR":"Oregon", "PA":"Pennsylvania", "RI":"Rhode_Island", "SC":"South_Carolina", "SD":"South_Dakota", "TN":"Tennessee", "TX":"Texas", "UT":"Utah", "VT":"Vermont", "VA":"Virginia", "WA":"Washington", "WV":"West_Virginia", "WI":"Wisconsin", "WY":"Wyoming"}, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    houseViewingData, // viewingDataFunction
    houseZoomingData, // zoomingDataFunction
    null, // splitVoteDataFunction
    {showSplitVotesOnCanZoom: true, showSplitVoteBoxes: true}, // splitVoteDisplayOptions
    houseFormattedRegionName, // getFormattedRegionName
    function(homepageURL, regionID, regionIDToLinkMap, mapDate, shouldOpenHomepage, _)
    {
      if (mapDate == null) { return }

      var districtNumber
      if (regionID != null && regionID.includes(subregionSeparator))
      {
        districtNumber = regionID.split(subregionSeparator)[1]
        regionID = regionID.split(subregionSeparator)[0]
      }

      var linkToOpen = homepageURL + mapDate.getFullYear() + "_United_States_House_of_Representatives_elections"
      if (!shouldOpenHomepage)
      {
        if (getDecadeFromDate(mapDate) < 2000)
        {
          linkToOpen += "#" + regionIDToLinkMap[regionID]
        }
        else if (USAHouseMapType.getEV(getDecadeFromDate(mapDate), regionID) > 1)
        {
          linkToOpen += "_in_" + regionIDToLinkMap[regionID] + (districtNumber ? "#District_" + districtNumber : "")
        }
        else
        {
          linkToOpen += "#" + regionIDToLinkMap[regionID]
        }
        // linkToOpen += (USAHouseMapType.getEV(getDecadeFromDate(mapDate), regionID) > 1 ? "_in_" : "#") + regionIDToLinkMap[regionID] + (districtNumber ? "#District_" + districtNumber : "")
      }
      window.open(linkToOpen)
    }, // customOpenRegionLinkFunction
    null, // updateCustomMapFunction
    null, // convertMapDataRowToCSVFunction
    null, // isCustomMap
    null, // shouldClearDisabled
    true, // shouldShowVoteshare
    1.0, // voteshareCutoffMargin
    getHouseSVGFromDate, // overrideSVGPath
    null, // shouldSetDisabledWorthToZero
    true // shouldUseOriginalMapDataForTotalsPieChart
  )

  var idsToPartyNames = {}
  var partyNamesToIDs = {}
  for (var partyNum in mainPoliticalPartyIDs)
  {
    if (mainPoliticalPartyIDs[partyNum] == TossupParty.getID()) { continue }

    partyNamesToIDs[politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]] = mainPoliticalPartyIDs[partyNum]
    idsToPartyNames[mainPoliticalPartyIDs[partyNum]] = politicalParties[mainPoliticalPartyIDs[partyNum]].getNames()[0]
  }

  var CustomMapSource = new MapSource(
    "Custom-House", // id
    "Custom", // name
    null, // dataURL
    null, // homepageURL
    null, // iconURL
    {
      date: "date",
      region: "region",
      district: "district",
      candidateName: "candidate",
      partyID: "party",
      voteshare: "voteshare",
      order: "order"
    }, // columnMap
    null, // cycleYear
    partyNamesToIDs, // candidateNameToPartyIDMap
    idsToPartyNames, // shortCandidateNameOverride
    regionNameToIDHistorical, // regionNameToIDMap
    null, // regionIDToLinkMap
    null, // heldRegionMap
    false, // shouldFilterOutDuplicateRows
    true, // addDecimalPadding
    doubleLineVoteshareFilterFunction, // organizeMapDataFunction
    houseViewingData, // viewingDataFunction
    houseZoomingData, // zoomingDataFunction
    null, // splitVoteDataFunction
    {showSplitVotesOnCanZoom: true, showSplitVoteBoxes: true}, // splitVoteDisplayOptions
    houseFormattedRegionName, // getFormattedRegionName
    null, // customOpenRegionLinkFunction
    function(displayRegionData, mapDateData)
    {
      for (let regionID in displayRegionData)
      {
        if (!regionID.includes(subregionSeparator)) { continue }
        if (regionID.endsWith(subregionSeparator + statePopularVoteDistrictID)) { continue }

        let regionData = displayRegionData[regionID]
        regionData.region = regionID

        mapDateData[regionID] = cloneObject(regionData)
      }
    }, // updateCustomMapFunction
    customMapConvertMapDataToCSVFunction, // convertMapDataRowToCSVFunction
    true, // isCustomMap
    false, // shouldClearDisabled
    null, // shouldShowVoteshare
    null, // voteshareCutoffMargin
    getHouseSVGFromDate, // overrideSVGPath
    null, // shouldSetDisabledWorthToZero
    true // shouldUseOriginalMapDataForTotalsPieChart
  )

  var todayDate = new Date()
  CustomMapSource.setTextMapData("date\n" + (todayDate.getMonth()+1) + "/" + todayDate.getDate() + "/" + todayDate.getFullYear())

  var houseMapSources = {}
  houseMapSources[FiveThirtyEightHouseProjectionMapSource.getID()] = FiveThirtyEightHouseProjectionMapSource
  houseMapSources[PastElectionResultMapSource.getID()] = PastElectionResultMapSource
  houseMapSources[CustomMapSource.getID()] = CustomMapSource

  var houseMapSourceIDs = [FiveThirtyEightHouseProjectionMapSource.getID(), PastElectionResultMapSource.getID()]
  if (USAHouseMapType.getCustomMapEnabled())
  {
    houseMapSourceIDs.push(CustomMapSource.getID())
  }

  const kPastElectionsVsPastElections = 1

  var defaultHouseCompareSourceIDs = {}
  defaultHouseCompareSourceIDs[kPastElectionsVsPastElections] = [PastElectionResultMapSource.getID(), PastElectionResultMapSource.getID()]

  USAHouseMapType.setMapSources(houseMapSources)
  USAHouseMapType.setMapSourceIDs(houseMapSourceIDs)
  USAHouseMapType.setDefaultCompareSourceIDs(defaultHouseCompareSourceIDs)
  USAHouseMapType.setCustomSourceID(CustomMapSource.getID())
}

var mainTwoPartyIDsToNames = {}
mainTwoPartyIDsToNames[DemocraticParty.getID()] = DemocraticParty.getNames()[0]
mainTwoPartyIDsToNames[RepublicanParty.getID()] = RepublicanParty.getNames()[0]

var NullMapSource = new MapSource(
  "None", // id
  "None", // name
  null, // dataURL
  null, // homepageURL
  null, // iconURL
  null, // columnMap
  null, // cycleYear
  invertObject(mainTwoPartyIDsToNames), // candidateNameToPartyIDMap
  mainTwoPartyIDsToNames // shortCandidateNameOverride
)

createPresidentialMapSources()
createSenateMapSources()
createGovernorMapSources()
createHouseMapSources()
