# **App Name**: Atlas

## Core Features:

- Broker Selection Overlay: A draggable UI overlay allowing users to select their broker (IQOption, Quotex, Avalon).
- Automated Trading: Executes automated trading operations on the selected broker platform based on AI predictions and user-defined configurations.
- AI Prediction Integration: Consistently consults a locally hosted AI service at http://localhost:7070/predict to inform trading decisions, acting as a tool to influence actions within the trading strategy.
- Broker Adapter Interface: Abstracts broker-specific interactions (login, balance, stake, order placement) via a unified BrokerAdapter interface for IQOption, Quotex, and Avalon.
- Risk Management Configuration: Allows users to configure risk management settings such as daily profit target, maximum loss, stake percentage, and AI thresholds.
- Live Trading Panel: Displays real-time trading information including account balance, daily profit, win/loss ratio, and a trade history table.
- Trade Logging and Export: Logs all trade data and session information to a local SQLite database and offers the ability to export this data to CSV format.

## Style Guidelines:

- Primary color: A vibrant blue (#29ABE2) evokes a sense of technology and trust. In HSL this color is hue 197, saturation 70%, and lightness 52%.
- Background color: black, which is a lighter and less saturated version of the primary color to create a calming backdrop. In HSL this color is hue 197, saturation 43%, and lightness 93%.
- Accent color: A contrasting yellow (#FFDA63), adds energy and highlights important UI elements like calls to action. In HSL this color is hue 46, saturation 100%, and lightness 70%.
- Body and headline font: 'Inter' (sans-serif) for a clean, modern, and readable interface.
- Use minimalist line icons to represent different functions and data points.
- Overlay should be compact and dockable, providing essential information without obstructing the trading interface.
- Use subtle transitions and animations to provide feedback and guide the user through different states.