document.addEventListener(
    "DOMContentLoaded",
    function() {

        const content =
            document.getElementById(
                "reservationContent"
            );

        const params =
            new URLSearchParams(
                window.location.search
            );

        const bookingId =
            params.get("bookingId");

        function escapeHTML(
            value
        ) {
            return String(
                value || ""
            )
                .replace(
                    /&/g,
                    "&amp;"
                )
                .replace(
                    /</g,
                    "&lt;"
                )
                .replace(
                    />/g,
                    "&gt;"
                )
                .replace(
                    /"/g,
                    "&quot;"
                )
                .replace(
                    /'/g,
                    "&#039;"
                );
        }

        function formatMoney(
            amount
        ) {
            return Number(
                amount || 0
            ).toLocaleString(
                "en-NG"
            );
        }

        if (!bookingId) {

            content.innerHTML = `
                <div class="error-state">

                    <h2>
                        Reservation information is missing.
                    </h2>

                    <p>
                        We could not find the ride booking associated with this page.
                    </p>

                    <div class="reservation-actions">

                        <a
                            href="customer-dashboard.html"
                            class="reservation-button primary"
                        >
                            GO TO DASHBOARD
                        </a>

                    </div>

                </div>
            `;

            return;
        }

        firebase.auth()
            .onAuthStateChanged(
                async function(user) {

                    if (!user) {
                        return;
                    }

                    try {

                        const snapshot =
                            await firebase
                                .firestore()
                                .collection(
                                    "rideBookings"
                                )
                                .doc(
                                    bookingId
                                )
                                .get();

                        if (
                            !snapshot.exists
                        ) {
                            throw new Error(
                                "Ride booking not found."
                            );
                        }

                        const booking =
                            snapshot.data();

                        if (
                            booking.userId !==
                            user.uid
                        ) {
                            throw new Error(
                                "You cannot access this reservation."
                            );
                        }

                        if (
                            booking.status !==
                                "RESERVED" ||
                            booking.paymentStatus !==
                                "UNPAID" ||
                            booking.paymentMethod !==
                                "PAY_ON_DEPARTURE"
                        ) {
                            throw new Error(
                                "This booking is not currently reserved for Pay on Departure."
                            );
                        }

                        const route =
                            escapeHTML(
                                String(
                                    booking.fromCity ||
                                    ""
                                )
                            ) +
                            " → " +
                            escapeHTML(
                                String(
                                    booking.toCity ||
                                    ""
                                )
                            );

                        const departure =
                            escapeHTML(
                                String(
                                    booking.confirmedDeparture ||
                                    booking.preferredTime ||
                                    "To be confirmed"
                                )
                            );

                        const travelDate =
                            escapeHTML(
                                String(
                                    booking.travelDate ||
                                    "To be confirmed"
                                )
                            );

                        const gatheringPoint =
                            escapeHTML(
                                String(
                                    booking.gatheringPoint ||
                                    "To be confirmed"
                                )
                            );

                        const finalDestination =
                            escapeHTML(
                                String(
                                    booking.finalDestination ||
                                    booking.toCity ||
                                    "To be confirmed"
                                )
                            );

                        const bookingReference =
                            escapeHTML(
                                String(
                                    booking.bookingReference ||
                                    bookingId
                                )
                            );

                        content.innerHTML = `

                            <div class="reservation-icon">
                                ✓
                            </div>

                            <h1>
                                Ride Reserved
                            </h1>

                            <p>
                                Your seat reservation has been confirmed.
                                Payment is still pending and must be completed
                                before boarding.
                            </p>

                            <div class="reservation-status">

                                <div class="reservation-row">

                                    <span>
                                        Booking Reference
                                    </span>

                                    <strong>
                                        ${bookingReference}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Route
                                    </span>

                                    <strong>
                                        ${route}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Travel Date
                                    </span>

                                    <strong>
                                        ${travelDate}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Departure
                                    </span>

                                    <strong>
                                        ${departure}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Gathering Point
                                    </span>

                                    <strong>
                                        ${gatheringPoint}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Final Destination
                                    </span>

                                    <strong>
                                        ${finalDestination}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Amount Due
                                    </span>

                                    <strong>
                                        ₦${formatMoney(
                                            booking.totalFare
                                        )}
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Payment
                                    </span>

                                    <strong>
                                        PAY ON DEPARTURE
                                    </strong>

                                </div>

                                <div class="reservation-row">

                                    <span>
                                        Status
                                    </span>

                                    <strong>
                                        RESERVED — UNPAID
                                    </strong>

                                </div>

                            </div>

                            <p>
                                Please complete payment before boarding.
                                Keep your booking reference available when you arrive.
                            </p>

                            <div class="reservation-actions">

                                <a
                                    href="customer-dashboard.html"
                                    class="reservation-button primary"
                                >
                                    GO TO DASHBOARD
                                </a>

                                <a
                                    href="ride.html"
                                    class="reservation-button secondary"
                                >
                                    VIEW AVAILABLE RIDES
                                </a>

                            </div>

                        `;

                    }
                    catch(error) {

                        console.error(
                            "Ride reservation confirmation error:",
                            error
                        );

                        content.innerHTML = `

                            <div class="error-state">

                                <h2>
                                    Unable to load reservation
                                </h2>

                                <p>
                                    ${escapeHTML(
                                        error.message ||
                                        "Something went wrong."
                                    )}
                                </p>

                                <div class="reservation-actions">

                                    <a
                                        href="customer-dashboard.html"
                                        class="reservation-button primary"
                                    >
                                        GO TO DASHBOARD
                                    </a>

                                </div>

                            </div>

                        `;

                    }

                }
            );

    }
);
