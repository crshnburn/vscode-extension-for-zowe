/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

/* eslint-disable @typescript-eslint/restrict-plus-operands */

import { Gui, imperative, MessageSeverity, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { padLeft } from "@zowe/core-for-zowe-sdk";
import * as vscode from "vscode";
import { join as joinPath } from "path";
import { SettingsConfig } from "./SettingsConfig";
import * as loggerConfig from "../../log4jsconfig.json";
import { ZoweLocalStorage } from "./ZoweLocalStorage";

export class ZoweLogger {
    public static zeOutputChannel: vscode.OutputChannel;
    private static defaultLogLevel: "INFO";
    private static zeLogLevel: string;

    private static impLogger: imperative.Logger;

    public static async initializeZoweLogger(context: vscode.ExtensionContext): Promise<void> {
        try {
            const logsPath: string = ZoweVsCodeExtension.customLoggingPath ?? context.extensionPath;
            this.initializeImperativeLogger(logsPath);
            await this.initVscLogger(context, logsPath);
        } catch (err) {
            // Don't log error if logger failed to initialize
            if (err instanceof Error) {
                const errorMessage = vscode.l10n.t("Error encountered while activating and initializing logger");
                await Gui.errorMessage(`${errorMessage}: ${err.message}`);
            }
        }
    }

    /**
     * Initializes Imperative Logger
     * @param logsPath File path for logs folder defined in preferences
     */
    private static initializeImperativeLogger(logsPath: string): void {
        const zeLogLevel = ZoweLogger.getLogSetting();
        const loggerConfigCopy = JSON.parse(JSON.stringify(loggerConfig));
        for (const appenderName of Object.keys(loggerConfigCopy.log4jsConfig.appenders)) {
            loggerConfigCopy.log4jsConfig.appenders[appenderName].filename = joinPath(
                logsPath,
                loggerConfigCopy.log4jsConfig.appenders[appenderName].filename
            );
            loggerConfigCopy.log4jsConfig.categories[appenderName].level = zeLogLevel;
        }
        imperative.Logger.initLogger(loggerConfigCopy);
        this.impLogger = imperative.Logger.getAppLogger();
    }

    public static trace(message: string): void {
        this.writeLogMessage(message, MessageSeverity.TRACE);
    }

    public static debug(message: string): void {
        this.writeLogMessage(message, MessageSeverity.DEBUG);
    }

    public static info(message: string): void {
        this.writeLogMessage(message, MessageSeverity.INFO);
    }

    public static warn(message: string): void {
        this.writeLogMessage(message, MessageSeverity.WARN);
    }

    public static error(message: string): void {
        this.writeLogMessage(message, MessageSeverity.ERROR);
    }

    public static fatal(message: string): void {
        this.writeLogMessage(message, MessageSeverity.FATAL);
    }

    public static disposeZoweLogger(): void {
        this.zeOutputChannel.dispose();
    }

    public static getLogSetting(): string {
        this.zeLogLevel = vscode.workspace.getConfiguration("zowe").get("logger");
        return this.zeLogLevel ?? this.defaultLogLevel;
    }

    public static get imperativeLogger(): imperative.Logger {
        return this.impLogger;
    }

    private static async initVscLogger(context: vscode.ExtensionContext, logFileLocation: string): Promise<void> {
        this.zeOutputChannel = Gui.createOutputChannel(vscode.l10n.t("Zowe Explorer"));
        this.writeVscLoggerInfo(logFileLocation, context);
        this.info(vscode.l10n.t("Initialized logger for Zowe Explorer"));
        await this.compareCliLogSetting();
    }

    private static writeVscLoggerInfo(logFileLocation: string, context: vscode.ExtensionContext): void {
        this.zeOutputChannel?.appendLine(`${context.extension.packageJSON.displayName as string} ${context.extension.packageJSON.version as string}`);
        this.zeOutputChannel?.appendLine(
            vscode.l10n.t({
                message: "This log file can be found at {0}",
                args: [logFileLocation],
                comment: ["Log file location"],
            })
        );
        this.zeOutputChannel?.appendLine(
            vscode.l10n.t({
                message: "Zowe Explorer log level: {0}",
                args: [this.getLogSetting()],
                comment: ["Log setting"],
            })
        );
    }

    private static writeLogMessage(message: string, severity: MessageSeverity): void {
        if (+MessageSeverity[this.getLogSetting()] <= +severity) {
            const severityName = MessageSeverity[severity];
            this.imperativeLogger[severityName?.toLowerCase()](message);
            this.zeOutputChannel?.appendLine(this.createMessage(message, severityName));
        }
    }

    private static createMessage(msg: string, level: string): string {
        return `[${getDate()} ${getTime()}] [${level}] ${msg}`;
    }

    private static async compareCliLogSetting(): Promise<void> {
        const cliLogSetting = this.getZoweLogEnVar();
        const zeLogSetting = this.zeLogLevel ?? this.getLogSetting();
        if (cliLogSetting && +MessageSeverity[zeLogSetting] !== +MessageSeverity[cliLogSetting]) {
            const notified = SettingsConfig.getCliLoggerSetting();
            if (!notified) {
                await this.updateVscLoggerSetting(cliLogSetting);
            }
        }
    }

    private static async updateVscLoggerSetting(cliSetting: string): Promise<void> {
        const updateLoggerButton = vscode.l10n.t("Update");
        const message = vscode.l10n.t({
            message: `Zowe Explorer now has a VS Code logger with a default log level of INFO.
                \nIt looks like the Zowe CLI's ZOWE_APP_LOG_LEVEL={0}.
                \nWould you like Zowe Explorer to update to the the same log level?`,
            args: [cliSetting],
            comment: ["CLI setting"],
        });
        await Gui.infoMessage(message, {
            items: [updateLoggerButton],
            vsCodeOpts: { modal: true },
        }).then(async (selection) => {
            if (selection === updateLoggerButton) {
                await this.setLogSetting(cliSetting);
            }
            SettingsConfig.setCliLoggerSetting(true);
        });
    }

    private static setLogSetting(setting: string): void {
        ZoweLocalStorage.setValue("zowe.logger", setting);
    }

    private static getZoweLogEnVar(): string {
        return process.env.ZOWE_APP_LOG_LEVEL;
    }
}

export function getDate(): string {
    const dateObj = new Date(Date.now());
    const day = ("0" + dateObj?.getDate()).slice(-2);
    const month = ("0" + (dateObj?.getMonth() + 1)).slice(-2);
    return `${dateObj.getFullYear()}/${month}/${day}`;
}

export function getTime(): string {
    const dateObj = new Date(Date.now());
    const hours = padLeft(dateObj?.getHours().toString(), 2, "0");
    const minutes = padLeft(dateObj?.getMinutes().toString(), 2, "0");
    const seconds = padLeft(dateObj?.getSeconds().toString(), 2, "0");
    return `${hours}:${minutes}:${seconds}`;
}
